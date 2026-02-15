import logging
import re
import time
from datetime import datetime

from celery import shared_task
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from api.models import SearchMethod
from api.zotero_service import ZoteroService

from .models import Reference, Review, ZoteroIntegration, ZoteroSyncLog


logger = logging.getLogger(__name__)


# tasks.py
@shared_task(bind=True, max_retries=3)
def push_references_to_zotero_task(self, review_id: int):
    """
    Async task to push all unpushed references to Zotero in batches of 50

    Zotero API limit: Maximum 50 items per write request
    Rate limit: 120 requests per minute

    Args:
        review_id: ID of the review
    """
    try:
        review = Review.objects.get(id=review_id)

        # Get Zotero integration
        try:
            zotero_integration = review.zotero_integration
        except ZoteroIntegration.DoesNotExist:
            return {
                "success": False,
                "error": "Zotero integration not configured",
                "pushed": 0,
                "failed": 0,
            }

        if not zotero_integration.is_configured:
            return {
                "success": False,
                "error": "Zotero credentials not configured",
                "pushed": 0,
                "failed": 0,
            }

        # Get credentials
        library_id, api_key, library_type = zotero_integration.get_credentials()

        # Initialize Zotero service
        zotero = ZoteroService(library_id, api_key, library_type)

        # Get all references to push
        all_references = Reference.objects.filter(
            review=review, zotero_key__isnull=True
        )

        total_count = all_references.count()

        if total_count == 0:
            return {
                "success": True,
                "message": "No references to push",
                "pushed": 0,
                "failed": 0,
            }

        # Zotero API limit: 50 items per write request
        batch_size = 50
        # Rate limit: 120 requests/minute = 2 requests/second
        # To be safe, we'll do ~1 request per second
        rate_limit_delay = 1.0

        logger.info(
            f"Pushing {total_count} references in batches of {batch_size} "
            f"(estimated {((total_count - 1) // batch_size) + 1} batches)"
        )

        total_pushed = 0
        total_failed = 0
        all_errors = []

        # Process in batches
        offset = 0
        batch_number = 1
        start_time = time.time()
        total_batches = ((total_count - 1) // batch_size) + 1

        while offset < total_count:
            batch_start_time = time.time()

            # Get next batch
            batch_references = all_references[offset : offset + batch_size]
            batch_count = batch_references.count()

            if batch_count == 0:
                break

            logger.info(
                f"Processing batch {batch_number}/{total_batches}: "
                f"{batch_count} references (offset: {offset})"
            )

            # Push this batch
            try:
                result = zotero.push_references_to_zotero(
                    list(batch_references), zotero_integration.collection_key
                )

                batch_pushed = result.get("created", 0)
                batch_failed = result.get("failed", 0)

                total_pushed += batch_pushed
                total_failed += batch_failed

                # Collect errors
                if result.get("errors"):
                    for idx, error in result["errors"].items():
                        all_errors.append(
                            f"Batch {batch_number}, Item {idx}: {error.get('message', 'Unknown')}"
                        )

                batch_time = time.time() - batch_start_time
                logger.info(
                    f"Batch {batch_number} complete: "
                    f"pushed={batch_pushed}, failed={batch_failed}, "
                    f"time={batch_time:.2f}s"
                )

            except Exception as batch_error:
                logger.error(f"Batch {batch_number} failed: {str(batch_error)}")
                total_failed += batch_count
                all_errors.append(f"Batch {batch_number} failed: {str(batch_error)}")

            # Move to next batch
            offset += batch_size
            batch_number += 1

            # Rate limiting between batches (skip for last batch)
            if offset < total_count and rate_limit_delay > 0:
                elapsed = time.time() - batch_start_time
                sleep_time = max(0, rate_limit_delay - elapsed)
                if sleep_time > 0:
                    logger.info(
                        f"Rate limiting: waiting {sleep_time:.2f}s before next batch"
                    )
                    time.sleep(sleep_time)

        total_time = time.time() - start_time

        # Update integration
        zotero_integration.last_push_at = timezone.now()
        zotero_integration.save()

        # Create log
        success_message = f"Pushed {total_pushed} references"
        if total_failed > 0:
            success_message += f", {total_failed} failed"
        if total_batches > 1:
            success_message += f" (in {total_batches} batches, {total_time:.1f}s)"

        ZoteroSyncLog.objects.create(
            review=review,
            sync_type="push",
            items_processed=total_pushed,
            success=total_pushed > 0,
            error_message="; ".join(all_errors[:10]) if all_errors else "",
        )

        logger.info(
            f"Push complete: pushed={total_pushed}, failed={total_failed}, "
            f"batches={total_batches}, time={total_time:.2f}s"
        )

        return {
            "success": True,
            "pushed": total_pushed,
            "failed": total_failed,
            "total_attempted": total_count,
            "batches_processed": total_batches,
            "total_time_seconds": round(total_time, 2),
            "review_id": review_id,
            "errors": all_errors[:20] if all_errors else [],
        }

    except Review.DoesNotExist:
        logger.error(f"Review {review_id} not found")
        return {"success": False, "error": "Review not found", "pushed": 0, "failed": 0}
    except Exception as e:
        logger.exception(f"Push task error: {str(e)}")

        # Log failed sync
        try:
            review = Review.objects.get(id=review_id)
            ZoteroSyncLog.objects.create(
                review=review,
                sync_type="push",
                items_processed=0,
                success=False,
                error_message=str(e),
            )
        except Exception as e:
            logger.error(f"Error pushing to zotero: {e}")

        # Retry on failure
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)
        else:
            return {
                "success": False,
                "error": f"Failed after {self.max_retries} retries: {str(e)}",
                "pushed": 0,
                "failed": 0,
            }


def zotero_type_to_pub_type(zotero_type: str) -> str:
    """Convert Zotero item type to your publication type"""
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
    """Format Zotero creators to author string"""
    if not creators:
        return ""

    author_strings = []
    for creator in creators:
        if creator.get("creatorType") != "author":
            continue

        if "name" in creator:
            # Single field name
            author_strings.append(creator["name"])
        elif "lastName" in creator and "firstName" in creator:
            # Two field name
            author_strings.append(f"{creator['lastName']}, {creator['firstName']}")
        elif "lastName" in creator:
            author_strings.append(creator["lastName"])

    return "; ".join(author_strings)


def parse_zotero_date(date_str: str):
    """Parse Zotero date string to date object"""
    if not date_str:
        return None

    # Try to extract year
    year_match = re.search(r"\b(19|20)\d{2}\b", date_str)
    if year_match:
        year = int(year_match.group())

        # Try to parse full date
        for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y", "%B %d, %Y"]:
            try:
                return datetime.strptime(date_str, fmt).date()
            except Exception as e:
                logger.error(f"Error parsing zotero date: {e}")
                continue

        # Just return year as January 1st
        return datetime(year, 1, 1).date()

    return None


def get_or_create_zotero_search_method(review):
    """Get or create a SearchMethod for Zotero imports"""
    search_method, _ = SearchMethod.objects.get_or_create(
        review=review,
        name="Zotero Import",
    )
    return search_method


@shared_task(bind=True, max_retries=3)
def pull_references_from_zotero_task(self, review_id: int, force: bool = False):
    """
    Pull references and PDFs from Zotero

    Zotero API limit: Maximum 100 items per read request
    Rate limit: 120 requests per minute

    Args:
        review_id: ID of the review
        force: If True, pull all items regardless of version
    """
    try:
        review = Review.objects.get(id=review_id)

        # Get Zotero integration
        try:
            zotero_integration = review.zotero_integration
        except ZoteroIntegration.DoesNotExist:
            return {"success": False, "error": "Zotero integration not configured"}

        if not zotero_integration.is_configured:
            return {"success": False, "error": "Zotero credentials not configured"}

        # Get credentials
        library_id, api_key, library_type = zotero_integration.get_credentials()

        # Initialize service
        zotero = ZoteroService(library_id, api_key, library_type)

        # Determine max_version for incremental sync
        if force:
            max_version = 0
            logger.info("Force pull: fetching all items")
        elif zotero_integration.collection_key:
            # For collections, always get all items
            max_version = 0
            logger.info("Collection pull: fetching all items from collection")
        else:
            # For entire library, use incremental sync
            max_version = zotero_integration.last_sync_version
            logger.info(f"Incremental pull: fetching items since version {max_version}")

        # Pull from Zotero with pagination
        # The ZoteroService already handles pagination internally via pyzotero
        result = zotero.pull_references_from_zotero(
            max_version, zotero_integration.collection_key
        )

        if not result["success"]:
            raise self.retry(exc=Exception(result.get("error")), countdown=60)

        items = result["items"]
        pdfs_downloaded = 0
        items_updated = 0
        items_created = 0
        errors = []

        logger.info(f"Processing {len(items)} top-level items from Zotero")

        # Process items
        with transaction.atomic():
            for item in items:
                try:
                    data = item.get("data", {})
                    item_key = data.get("key")
                    item_type = data.get("itemType")

                    if not item_key:
                        continue

                    # Skip attachments, notes, annotations
                    if item_type in ["attachment", "note", "annotation"]:
                        logger.warning(f"Skipping {item_type}: {item_key}")
                        continue

                    logger.info(f"Processing item {item_key} ({item_type})")

                    # Find or create reference
                    reference, is_new = Reference.objects.get_or_create(
                        review=review,
                        zotero_key=item_key,
                        defaults={
                            "title": data.get("title", "Untitled"),
                            "publication_type": zotero_type_to_pub_type(item_type),
                            "authors": format_creators(data.get("creators", [])),
                            "journal": data.get("publicationTitle")
                            or data.get("proceedingsTitle", ""),
                            "abstract": data.get("abstractNote", ""),
                            "doi": data.get("DOI", ""),
                            "url": data.get("url", ""),
                            "publication_date": parse_zotero_date(data.get("date", "")),
                            "search_method": get_or_create_zotero_search_method(review),
                            "article_customizations": "",
                            "zotero_version": data.get("version", 0),
                        },
                    )

                    # Update existing reference
                    if not is_new:
                        reference.zotero_version = data.get("version", 0)

                    reference.last_synced = timezone.now()

                    # Get PDF attachments
                    logger.info(f"Fetching children for item {item_key}")
                    children_result = zotero.get_item_with_children(item_key)

                    if not children_result["success"]:
                        logger.error(f"Failed to get children for {item_key}")
                        errors.append(f"Item {item_key}: Failed to get attachments")
                        reference.save()
                        if is_new:
                            items_created += 1
                        else:
                            items_updated += 1
                        continue

                    children = children_result["children"]
                    logger.info(f"Item {item_key} has {len(children)} children")

                    # Look for PDF attachments
                    if not reference.file or not reference.file.name:
                        for child in children:
                            child_data = child.get("data", {})

                            if (
                                child_data.get("itemType") == "attachment"
                                and child_data.get("contentType") == "application/pdf"
                            ):
                                attachment_key = child_data.get("key")
                                logger.info(
                                    f"Downloading PDF attachment {attachment_key}"
                                )

                                pdf_content = zotero.download_pdf_file(attachment_key)

                                if pdf_content and len(pdf_content) > 0:
                                    filename = f"{item_key}.pdf"
                                    reference.file.save(
                                        filename, ContentFile(pdf_content), save=False
                                    )
                                    pdfs_downloaded += 1
                                    logger.info(
                                        f"Downloaded PDF for {item_key} ({len(pdf_content)} bytes)"
                                    )
                                    break
                                else:
                                    logger.warning(
                                        f"PDF download returned empty content for {attachment_key}"
                                    )

                    reference.save()

                    if is_new:
                        items_created += 1
                    else:
                        items_updated += 1

                except Exception as e:
                    errors.append(f"Item {item_key}: {str(e)}")
                    logger.exception(f"Error processing {item_key}")

        # Update integration metadata
        zotero_integration.last_pull_at = timezone.now()
        zotero_integration.last_sync_version = result.get("library_version", 0)
        zotero_integration.save()

        # Log sync
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
            f"Pull complete: {items_created} created, {items_updated} updated, "
            f"{pdfs_downloaded} PDFs downloaded"
        )

        return {
            "success": True,
            "items_updated": items_updated,
            "items_created": items_created,
            "pdfs_downloaded": pdfs_downloaded,
            "errors": errors,
            "review_id": review_id,
        }

    except Review.DoesNotExist:
        return {"success": False, "error": "Review not found"}
    except Exception as e:
        logger.exception(f"Pull task error: {str(e)}")
        raise self.retry(exc=e, countdown=60)


@shared_task(bind=True)
def sync_single_reference_pdf(self, reference_id: int):
    """
    Sync a single reference's PDF from Zotero

    Args:
        reference_id: ID of the reference
    """
    try:
        reference = Reference.objects.select_related("review").get(id=reference_id)

        if not reference.zotero_key:
            return {"success": False, "error": "Reference not linked to Zotero"}

        review = reference.review

        if not review.zotero_library_id or not review.zotero_api_key:
            return {"success": False, "error": "Zotero credentials not configured"}

        zotero = ZoteroService(
            review.zotero_library_id, review.zotero_api_key, review.zotero_library_type
        )

        # Get children (attachments)
        children_result = zotero.get_item_with_children(reference.zotero_key)

        if not children_result["success"]:
            return {"success": False, "error": "Failed to get attachments"}

        children = children_result["children"]

        # Look for PDF attachments
        for child in children:
            child_data = child.get("data", {})

            if (
                child_data.get("itemType") == "attachment"
                and child_data.get("contentType") == "application/pdf"
            ):
                attachment_key = child_data.get("key")

                # Download PDF
                pdf_content = zotero.download_pdf_file(attachment_key)

                if pdf_content:
                    # Save PDF file
                    filename = f"{reference.zotero_key}.pdf"
                    reference.file.save(filename, ContentFile(pdf_content), save=False)
                    reference.last_synced = timezone.now()
                    reference.save()

                    logger.info(f"Downloaded PDF for reference {reference_id}")

                    return {
                        "success": True,
                        "reference_id": reference_id,
                        "pdf_size": len(pdf_content),
                    }

        return {"success": False, "error": "No PDF attachment found"}

    except Reference.DoesNotExist:
        return {"success": False, "error": "Reference not found"}
    except Exception as e:
        logger.exception(f"Error syncing PDF for reference {reference_id}: {str(e)}")
        raise self.retry(exc=e, countdown=30)
