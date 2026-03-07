"""
Celery tasks for Zotero push and pull operations.

Task inventory
--------------
push_references_to_zotero_task(review_id)
    Pushes all in-full-text references without a zotero_key to Zotero in
    batches of 50.  Sends real-time progress to WebSocket clients via Django
    Channels.  Retries up to 3 times on unexpected failure.

pull_references_from_zotero_task(review_id, force=False)
    Fetches new/updated items from Zotero, creates or updates Reference rows,
    and downloads PDF attachments.  Uses ``last_sync_version`` for incremental
    syncs unless ``force=True``.  Retries up to 3 times.

sync_single_reference_pdf(reference_id)
    Backfills a PDF for a single reference that was pulled without one.
    Retries up to 3 times with a 30-second delay.

Helper functions (module-level, not tasks)
------------------------------------------
send_task_update(task_id, status, message, ...)
    Publishes a status dict to the ``task_<id>`` channel group via the
    Django Channels layer.  No-ops gracefully when the channel layer is
    unavailable.

zotero_type_to_pub_type(zotero_type)
    Maps a Zotero itemType string to a local publication_type string.

format_creators(creators)
    Converts a pyzotero creators list to a semicolon-separated author string.

parse_zotero_date(date_str)
    Parses a Zotero date string (various formats) to a Python date object.

get_or_create_zotero_search_method(review)
    Returns (or creates) the SearchMethod row used to tag Zotero-imported
    references.
"""

import logging
import re
import time
from datetime import datetime

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from slrt_project.integrations.models import ZoteroIntegration, ZoteroSyncLog
from slrt_project.integrations.services import ZoteroService
from slrt_project.references.models import Reference
from slrt_project.reviews.models import Review, SearchMethod


logger = logging.getLogger(__name__)


# ===========================================================================
# WebSocket helper
# ===========================================================================


def send_task_update(
    task_id: str,
    status: str,
    message: str,
    result=None,
    error=None,
    **extra_data,
):
    """
    Publish a task status update to all WebSocket clients watching this task.

    Clients subscribe to the ``task_<task_id>`` channel group.  The message
    type ``task_status_update`` is handled by the consumer on the frontend.

    This is a best-effort call — when the channel layer is not configured
    (e.g. in tests or development without Redis) it logs a warning and
    returns without raising.

    Parameters
    ----------
    task_id : str
        Celery task ID, used to target the correct channel group.
    status : str
        One of PENDING / STARTED / PROGRESS / SUCCESS / FAILURE.
    message : str
        Human-readable status message shown in the UI.
    result : any, optional
        Final result payload — only set on SUCCESS.
    error : str, optional
        Error description — only set on FAILURE.
    **extra_data
        Any additional fields (e.g. ``progress``, ``total``, ``pushed``)
        to include in the update dict.
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        logger.warning("Channel layer not available, cannot send task update")
        return

    data = {"task_id": task_id, "status": status, "message": message, **extra_data}
    if result is not None:
        data["result"] = result
    if error is not None:
        data["error"] = error

    async_to_sync(channel_layer.group_send)(
        f"task_{task_id}",
        {"type": "task_status_update", "data": data},
    )
    logger.info("Sent task update for %s: %s", task_id, status)


# ===========================================================================
# Push task
# ===========================================================================


@shared_task(bind=True, max_retries=3)
def push_references_to_zotero_task(self, review_id: int):
    """
    Push all unpushed references to Zotero in batches of 50.

    A reference is considered «unpushed» when ``zotero_key`` is NULL and
    ``in_full_text=True``.  The task processes the full set in 50-item batches
    to stay within the Zotero write-batch limit, sleeping 1 second between
    batches to respect the API rate limit.

    After each batch the task sends a PROGRESS update via WebSocket so the
    UI can display a live progress bar.

    On success it:
        - updates ``ZoteroIntegration.last_push_at``
        - creates a ``ZoteroSyncLog`` row with counts and any error snippets

    On unexpected exception it retries up to ``max_retries`` times with a
    60-second countdown before giving up and returning a failure dict.
    """
    task_id = self.request.id

    try:
        send_task_update(
            task_id, status="STARTED", message="Starting push to Zotero..."
        )

        review = Review.objects.get(id=review_id)

        # ── Validate integration ───────────────────────────────────────────
        try:
            zotero_integration = review.zotero_integration
        except ZoteroIntegration.DoesNotExist:
            send_task_update(
                task_id,
                status="FAILURE",
                message="Zotero integration not configured",
                error="Zotero integration not configured",
            )
            return {
                "success": False,
                "error": "Zotero integration not configured",
                "pushed": 0,
                "failed": 0,
            }

        if not zotero_integration.is_configured:
            send_task_update(
                task_id,
                status="FAILURE",
                message="Zotero credentials not configured",
                error="Zotero credentials not configured",
            )
            return {
                "success": False,
                "error": "Zotero credentials not configured",
                "pushed": 0,
                "failed": 0,
            }

        library_id, api_key, library_type = zotero_integration.get_credentials()
        zotero = ZoteroService(library_id, api_key, library_type)

        # ── Gather references ─────────────────────────────────────────────
        # Filter to in_full_text so we only push references that have passed
        # screening, not raw search results.
        all_references = Reference.objects.filter(
            review=review,
            in_full_text=True,
            zotero_key__isnull=True,
        )
        total_count = all_references.count()

        if total_count == 0:
            send_task_update(
                task_id,
                status="SUCCESS",
                message="No references to push",
                result={"pushed": 0, "failed": 0},
            )
            return {
                "success": True,
                "message": "No references to push",
                "pushed": 0,
                "failed": 0,
            }

        batch_size = 50
        rate_limit_delay = 1.0  # seconds between batches

        logger.info("Pushing %d references in batches of %d", total_count, batch_size)
        send_task_update(
            task_id,
            status="PROGRESS",
            message=f"Pushing {total_count} references in batches of {batch_size}...",
            progress=0,
            total=total_count,
        )

        total_pushed = 0
        total_failed = 0
        all_errors = []

        offset = 0
        batch_number = 1
        start_time = time.time()
        total_batches = ((total_count - 1) // batch_size) + 1

        # ── Batch loop ────────────────────────────────────────────────────
        while offset < total_count:
            batch_start_time = time.time()
            batch_references = all_references[offset : offset + batch_size]
            batch_count = batch_references.count()
            if batch_count == 0:
                break

            send_task_update(
                task_id,
                status="PROGRESS",
                message=(
                    f"Processing batch {batch_number}/{total_batches} "
                    f"({batch_count} references)..."
                ),
                progress=offset,
                total=total_count,
                batch_number=batch_number,
                total_batches=total_batches,
            )

            logger.info(
                "Processing batch %d/%d: %d references (offset: %d)",
                batch_number,
                total_batches,
                batch_count,
                offset,
            )

            try:
                result = zotero.push_references_to_zotero(
                    list(batch_references), zotero_integration.collection_key
                )

                batch_pushed = result.get("created", 0)
                batch_failed = result.get("failed", 0)
                total_pushed += batch_pushed
                total_failed += batch_failed

                # Collect per-item error details (Zotero returns an error dict
                # keyed by item index) for the final sync log.
                if result.get("errors"):
                    for idx, error in result["errors"].items():
                        all_errors.append(
                            f"Batch {batch_number}, Item {idx}: "
                            f"{error.get('message', 'Unknown')}"
                        )

                logger.info(
                    "Batch %d complete: pushed=%d, failed=%d, time=%.2fs",
                    batch_number,
                    batch_pushed,
                    batch_failed,
                    time.time() - batch_start_time,
                )

                send_task_update(
                    task_id,
                    status="PROGRESS",
                    message=(
                        f"Batch {batch_number}/{total_batches} complete: "
                        f"{batch_pushed} pushed, {batch_failed} failed"
                    ),
                    progress=offset + batch_count,
                    total=total_count,
                    pushed=total_pushed,
                    failed=total_failed,
                )

            except Exception as batch_error:
                # A single batch error should not abort the whole task — log
                # it, count all items in the batch as failed, and continue.
                logger.error("Batch %d failed: %s", batch_number, batch_error)
                total_failed += batch_count
                all_errors.append(f"Batch {batch_number} failed: {batch_error}")
                send_task_update(
                    task_id,
                    status="PROGRESS",
                    message=f"Batch {batch_number}/{total_batches} failed",
                    progress=offset + batch_count,
                    total=total_count,
                    error=str(batch_error),
                )

            offset += batch_size
            batch_number += 1

            # Rate-limit pause: sleep for the remainder of the 1-second window
            # so we don't immediately start the next batch.
            if offset < total_count and rate_limit_delay > 0:
                elapsed = time.time() - batch_start_time
                sleep_time = max(0, rate_limit_delay - elapsed)
                if sleep_time > 0:
                    logger.info("Rate limiting: waiting %.2fs", sleep_time)
                    time.sleep(sleep_time)

        # ── Post-loop bookkeeping ─────────────────────────────────────────
        total_time = time.time() - start_time

        zotero_integration.last_push_at = timezone.now()
        zotero_integration.save()

        # Store at most 10 error snippets in the log to keep it readable.
        ZoteroSyncLog.objects.create(
            review=review,
            sync_type="push",
            items_processed=total_pushed,
            success=total_pushed > 0,
            error_message="; ".join(all_errors[:10]) if all_errors else "",
        )

        logger.info(
            "Push complete: pushed=%d, failed=%d, batches=%d, time=%.2fs",
            total_pushed,
            total_failed,
            total_batches,
            total_time,
        )

        result_data = {
            "success": True,
            "pushed": total_pushed,
            "failed": total_failed,
            "total_attempted": total_count,
            "batches_processed": total_batches,
            "total_time_seconds": round(total_time, 2),
            "review_id": review_id,
            # Cap at 20 errors in the return value to avoid huge task results.
            "errors": all_errors[:20] if all_errors else [],
        }

        send_task_update(
            task_id,
            status="SUCCESS",
            message=(
                f"Push complete: {total_pushed} pushed, {total_failed} failed "
                f"in {total_time:.1f}s"
            ),
            result=result_data,
        )
        return result_data

    except Review.DoesNotExist:
        error_msg = "Review not found"
        logger.error("Review %d not found", review_id)
        send_task_update(task_id, status="FAILURE", message=error_msg, error=error_msg)
        return {"success": False, "error": error_msg, "pushed": 0, "failed": 0}

    except Exception as e:
        logger.exception("Push task error: %s", e)
        send_task_update(
            task_id, status="FAILURE", message=f"Task failed: {e}", error=str(e)
        )
        # Try to write a failure log so at least one entry exists for this run.
        try:
            review = Review.objects.get(id=review_id)
            ZoteroSyncLog.objects.create(
                review=review,
                sync_type="push",
                items_processed=0,
                success=False,
                error_message=str(e),
            )
        except Exception as log_err:
            logger.error("Error writing failure log: %s", log_err)

        # Retry with exponential back-off.  After max_retries the exception
        # propagates and Celery marks the task as FAILURE.
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)
        return {
            "success": False,
            "error": f"Failed after {self.max_retries} retries: {e}",
            "pushed": 0,
            "failed": 0,
        }


# ===========================================================================
# Pull task
# ===========================================================================


@shared_task(bind=True, max_retries=3)
def pull_references_from_zotero_task(self, review_id: int, force: bool = False):
    """
    Pull references and PDF attachments from Zotero.

    Sync strategy
    -------------
    - Whole library, incremental: uses ``last_sync_version`` so only items
      changed since the last pull are fetched.
    - Whole library, forced: ``force=True`` resets the version to 0 and
      re-fetches everything.
    - Collection filter: always fetches all items from the collection
      (version-based incremental sync is not reliable for collections).

    For each Zotero item the task:
        1. get_or_create a Reference row keyed on ``zotero_key``.
        2. Fetches the item's children to find PDF attachments.
        3. Downloads the first PDF attachment if the reference has none.

    The entire item-processing loop runs inside a single DB transaction so a
    mid-run crash leaves the table in the pre-run state.

    After the loop it updates ``last_pull_at`` and ``last_sync_version`` on
    the integration, and creates a ZoteroSyncLog entry.
    """
    task_id = self.request.id

    try:
        send_task_update(
            task_id, status="STARTED", message="Starting pull from Zotero..."
        )

        review = Review.objects.get(id=review_id)

        # ── Validate integration ───────────────────────────────────────────
        try:
            zotero_integration = review.zotero_integration
        except ZoteroIntegration.DoesNotExist:
            send_task_update(
                task_id,
                status="FAILURE",
                message="Zotero integration not configured",
                error="Zotero integration not configured",
            )
            return {"success": False, "error": "Zotero integration not configured"}

        if not zotero_integration.is_configured:
            send_task_update(
                task_id,
                status="FAILURE",
                message="Zotero credentials not configured",
                error="Zotero credentials not configured",
            )
            return {"success": False, "error": "Zotero credentials not configured"}

        library_id, api_key, library_type = zotero_integration.get_credentials()
        zotero = ZoteroService(library_id, api_key, library_type)

        # ── Determine sync version ─────────────────────────────────────────
        if force:
            # Ignore the stored version and re-fetch everything.
            max_version = 0
            logger.info("Force pull: fetching all items")
        elif zotero_integration.collection_key:
            # Collection syncs always fetch the full collection because Zotero
            # version-based filtering is unreliable for collection membership.
            max_version = 0
            logger.info("Collection pull: fetching all items from collection")
        else:
            # Normal incremental sync — only items modified after this version.
            max_version = zotero_integration.last_sync_version
            logger.info(
                "Incremental pull: fetching items since version %d", max_version
            )

        send_task_update(
            task_id, status="PROGRESS", message="Fetching items from Zotero..."
        )

        result = zotero.pull_references_from_zotero(
            max_version, zotero_integration.collection_key
        )

        if not result["success"]:
            # Retry on transient API failures; the exception carries the error.
            raise self.retry(exc=Exception(result.get("error")), countdown=60)

        items = result["items"]
        total_items = len(items)

        send_task_update(
            task_id,
            status="PROGRESS",
            message=f"Processing {total_items} items from Zotero...",
            progress=0,
            total=total_items,
        )

        pdfs_downloaded = 0
        items_updated = 0
        items_created = 0
        errors = []

        logger.info("Processing %d top-level items from Zotero", len(items))

        # ── Item processing loop ───────────────────────────────────────────
        # Wrapped in a single transaction so a partial run does not leave
        # orphaned Reference rows.
        with transaction.atomic():
            for idx, item in enumerate(items, 1):
                try:
                    data = item.get("data", {})
                    item_key = data.get("key")
                    item_type = data.get("itemType")

                    if not item_key:
                        continue

                    # Attachments, notes and annotations are children of a
                    # parent item and are handled separately; skip here.
                    if item_type in ["attachment", "note", "annotation"]:
                        logger.warning("Skipping %s: %s", item_type, item_key)
                        continue

                    logger.info("Processing item %s (%s)", item_key, item_type)

                    # get_or_create keyed on zotero_key so re-running the task
                    # is idempotent (duplicate references are not created).
                    reference, is_new = Reference.objects.get_or_create(
                        review=review,
                        zotero_key=item_key,
                        defaults={
                            "title": data.get("title", "Untitled"),
                            "publication_type": zotero_type_to_pub_type(item_type),
                            "authors": format_creators(data.get("creators", [])),
                            # Use whichever publication title field is present.
                            "journal": (
                                data.get("publicationTitle")
                                or data.get("proceedingsTitle", "")
                            ),
                            "abstract": data.get("abstractNote", ""),
                            "doi": data.get("DOI", ""),
                            "url": data.get("url", ""),
                            "publication_date": parse_zotero_date(data.get("date", "")),
                            "search_method": get_or_create_zotero_search_method(review),
                            "article_customizations": "",
                            "zotero_version": data.get("version", 0),
                        },
                    )

                    if not is_new:
                        # Bump the stored version so subsequent incremental
                        # pulls skip this item unless Zotero modifies it again.
                        reference.zotero_version = data.get("version", 0)

                    reference.last_synced = timezone.now()

                    # ── PDF download ───────────────────────────────────────
                    logger.info("Fetching children for item %s", item_key)
                    children_result = zotero.get_item_with_children(item_key)

                    if not children_result["success"]:
                        logger.error("Failed to get children for %s", item_key)
                        errors.append(f"Item {item_key}: Failed to get attachments")
                        reference.save()
                        items_created += is_new
                        items_updated += not is_new
                        continue

                    children = children_result["children"]
                    logger.info("Item %s has %d children", item_key, len(children))

                    # Only download a PDF when the reference doesn't already
                    # have one — avoids re-downloading on repeated pulls.
                    if not reference.file or not reference.file.name:
                        for child in children:
                            child_data = child.get("data", {})
                            if (
                                child_data.get("itemType") == "attachment"
                                and child_data.get("contentType") == "application/pdf"
                            ):
                                attachment_key = child_data.get("key")
                                logger.info(
                                    "Downloading PDF attachment %s", attachment_key
                                )
                                pdf_content = zotero.download_pdf_file(attachment_key)

                                if pdf_content and len(pdf_content) > 0:
                                    reference.file.save(
                                        f"{item_key}.pdf",
                                        ContentFile(pdf_content),
                                        save=False,
                                    )
                                    pdfs_downloaded += 1
                                    logger.info(
                                        "Downloaded PDF for %s (%d bytes)",
                                        item_key,
                                        len(pdf_content),
                                    )
                                    # Stop after the first PDF attachment.
                                    break
                                else:
                                    logger.warning(
                                        "PDF download returned empty content for %s",
                                        attachment_key,
                                    )

                    reference.save()
                    items_created += is_new
                    items_updated += not is_new

                    # Send progress every 10 items to avoid flooding the
                    # channel layer on large libraries.
                    if idx % 10 == 0 or idx == total_items:
                        send_task_update(
                            task_id,
                            status="PROGRESS",
                            message=f"Processing item {idx}/{total_items}...",
                            progress=idx,
                            total=total_items,
                            created=items_created,
                            updated=items_updated,
                            pdfs=pdfs_downloaded,
                        )

                except Exception as e:
                    errors.append(f"Item {item_key}: {e}")
                    logger.exception("Error processing %s", item_key)

        # ── Post-loop bookkeeping ─────────────────────────────────────────
        zotero_integration.last_pull_at = timezone.now()
        # Store the library version returned by the API so the next
        # incremental pull only fetches items newer than this point.
        zotero_integration.last_sync_version = result.get("library_version", 0)
        zotero_integration.save()

        ZoteroSyncLog.objects.create(
            review=review,
            sync_type="pull",
            items_processed=items_updated + items_created,
            items_with_pdfs=pdfs_downloaded,
            library_version=result.get("library_version"),
            success=True,
            error_message="; ".join(errors[:5]) if errors else "",
        )

        logger.info(
            "Pull complete: %d created, %d updated, %d PDFs downloaded",
            items_created,
            items_updated,
            pdfs_downloaded,
        )

        result_data = {
            "success": True,
            "items_updated": items_updated,
            "items_created": items_created,
            "pdfs_downloaded": pdfs_downloaded,
            "errors": errors,
            "review_id": review_id,
        }

        send_task_update(
            task_id,
            status="SUCCESS",
            message=(
                f"Pull complete: {items_created} created, {items_updated} updated, "
                f"{pdfs_downloaded} PDFs"
            ),
            result=result_data,
        )
        return result_data

    except Review.DoesNotExist:
        return {"success": False, "error": "Review not found"}

    except Exception as e:
        # Guard: if self.retry() itself raised (e.g. MaxRetriesExceededError
        # or a test mock side_effect), re-raising it here would cause an
        # infinite retry loop.  Only retry when the exception did not
        # originate from self.retry() itself.
        from celery.exceptions import Retry

        if isinstance(e, Retry):
            raise
        logger.exception("Pull task error: %s", e)
        send_task_update(
            task_id, status="FAILURE", message=f"Pull failed: {e}", error=str(e)
        )
        raise self.retry(exc=e, countdown=60)


# ===========================================================================
# Single-reference PDF backfill task
# ===========================================================================


@shared_task(bind=True)
def sync_single_reference_pdf(self, reference_id: int):
    """
    Download a PDF for a single reference that was pulled without one.

    This task is intended as a backfill mechanism — e.g. triggered from the
    UI when a user notices a reference is missing its PDF.  It does NOT
    update ``last_sync_version`` because it processes only one item.

    Credentials are read from the review's ZoteroIntegration, consistent with
    the other tasks in this module.

    Retries up to 3 times with a 30-second delay on failure.
    """
    try:
        reference = Reference.objects.select_related("review").get(id=reference_id)

        if not reference.zotero_key:
            return {"success": False, "error": "Reference not linked to Zotero"}

        review = reference.review

        # Credentials live on ZoteroIntegration, not on the Review model directly.
        try:
            zotero_integration = review.zotero_integration
        except ZoteroIntegration.DoesNotExist:
            return {"success": False, "error": "Zotero integration not configured"}

        if not zotero_integration.is_configured:
            return {"success": False, "error": "Zotero credentials not configured"}

        library_id, api_key, library_type = zotero_integration.get_credentials()
        zotero = ZoteroService(library_id, api_key, library_type)

        children_result = zotero.get_item_with_children(reference.zotero_key)
        if not children_result["success"]:
            return {"success": False, "error": "Failed to get attachments"}

        # Walk children looking for the first PDF attachment.
        for child in children_result["children"]:
            child_data = child.get("data", {})
            if (
                child_data.get("itemType") == "attachment"
                and child_data.get("contentType") == "application/pdf"
            ):
                attachment_key = child_data.get("key")
                pdf_content = zotero.download_pdf_file(attachment_key)

                if pdf_content:
                    reference.file.save(
                        f"{reference.zotero_key}.pdf",
                        ContentFile(pdf_content),
                        save=False,
                    )
                    reference.last_synced = timezone.now()
                    reference.save()
                    logger.info("Downloaded PDF for reference %d", reference_id)
                    return {
                        "success": True,
                        "reference_id": reference_id,
                        "pdf_size": len(pdf_content),
                    }

        return {"success": False, "error": "No PDF attachment found"}

    except Reference.DoesNotExist:
        return {"success": False, "error": "Reference not found"}

    except Exception as e:
        logger.exception("Error syncing PDF for reference %d: %s", reference_id, e)
        raise self.retry(exc=e, countdown=30)


# ===========================================================================
# Module-level helper functions
# ===========================================================================


def zotero_type_to_pub_type(zotero_type: str) -> str:
    """
    Map a Zotero itemType string to a local publication_type string.

    Used when creating Reference rows from pulled Zotero items.  Unknown
    types default to ``'journal article'``.
    """
    mapping = {
        "journalArticle": "journal article",
        "conferencePaper": "conference paper",
        "book": "book",
        "bookSection": "book chapter",
        "thesis": "thesis",
        "report": "report",
        "preprint": "preprint",
        "webpage": "webpage",
        "magazineArticle": "magazine article",
        "newspaperArticle": "newspaper article",
    }
    return mapping.get(zotero_type, "journal article")


def format_creators(creators: list) -> str:
    """
    Convert a pyzotero creators list to a semicolon-separated author string.

    Only entries with ``creatorType == 'author'`` are included; editors,
    translators, etc. are skipped.  Supports both the two-field format
    (``lastName`` / ``firstName``) and the single-field format (``name``).
    """
    if not creators:
        return ""

    author_strings = []
    for creator in creators:
        if creator.get("creatorType") != "author":
            continue

        if "name" in creator:
            author_strings.append(creator["name"])
        elif "lastName" in creator and "firstName" in creator:
            author_strings.append(f"{creator['lastName']}, {creator['firstName']}")
        elif "lastName" in creator:
            author_strings.append(creator["lastName"])

    return "; ".join(author_strings)


def parse_zotero_date(date_str: str):
    """
    Parse a Zotero date string to a Python ``date`` object.

    Zotero stores dates as free-form strings (e.g. ``'2023'``, ``'2023-07'``,
    ``'July 2023'``, ``'2023-07-15'``).  The parser:

    1. Looks for a four-digit year via regex.
    2. Tries several common date format strings.
    3. Falls back to January 1st of the found year when only the year is
       parseable.

    Returns None when no year can be found.
    """
    if not date_str:
        return None

    year_match = re.search(r"\b(19|20)\d{2}\b", date_str)
    if not year_match:
        return None

    year = int(year_match.group())

    for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y", "%B %d, %Y"]:
        try:
            return datetime.strptime(date_str, fmt).date()
        except Exception as e:
            logger.debug("Date format %s did not match %r: %s", fmt, date_str, e)
            continue

    # Only the year was identifiable — default to Jan 1st.
    return datetime(year, 1, 1).date()


def get_or_create_zotero_search_method(review):
    """
    Return the SearchMethod row used to tag all Zotero-imported references.

    Using a dedicated SearchMethod (named ``'Zotero Import'``) lets users
    filter references by import source in the review's reference list.
    ``get_or_create`` makes the call idempotent — safe to call for every item
    during a pull.
    """
    search_method, _ = SearchMethod.objects.get_or_create(
        review=review,
        name="Zotero Import",
    )
    return search_method
