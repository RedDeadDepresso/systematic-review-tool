import logging
import re
from datetime import datetime

from celery import shared_task
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from api.models import SearchMethod
from api.zotero_service import ZoteroService

from .models import Reference, Review, ZoteroSyncLog


logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def push_references_to_zotero_task(self, review_id: int, batch_size: int = 50):
    """
    Async task to push references to Zotero

    Args:
        review_id: ID of the review
        batch_size: Number of references to push at once
    """
    try:
        review = Review.objects.get(id=review_id)

        if not review.zotero_library_id or not review.zotero_api_key:
            logger.error(f"Review {review_id} missing Zotero credentials")
            return {
                "success": False,
                "error": "Zotero credentials not configured",
                "pushed": 0,
                "failed": 0,
            }

        # Get references without Zotero keys (not yet pushed)
        references = Reference.objects.filter(review=review, zotero_key__isnull=True)[
            :batch_size
        ]

        count = references.count()
        logger.info(f"Found {count} references to push for review {review_id}")

        if count == 0:
            return {
                "success": True,
                "message": "No references to push",
                "pushed": 0,
                "failed": 0,
            }

        zotero = ZoteroService(
            review.zotero_library_id, review.zotero_api_key, review.zotero_library_type
        )

        # Get collection key if set
        collection_key = (
            review.zotero_collection_key if review.zotero_collection_key else None
        )

        if collection_key:
            logger.info(
                f"Pushing to collection: {review.zotero_collection_name or collection_key}"
            )
        else:
            logger.info("Pushing to library root (no collection)")

        # Push to Zotero (with optional collection)
        result = zotero.push_references_to_zotero(list(references), collection_key)

        logger.info(
            f"Push result: success={result.get('success')}, created={result.get('created')}, failed={result.get('failed')}"
        )

        # Log errors if any
        if result.get("errors"):
            error_summary = []
            for idx, error in list(result["errors"].items())[:5]:  # Log first 5 errors
                error_summary.append(f"Item {idx}: {error.get('message', 'Unknown')}")
            logger.error(f"Push errors: {'; '.join(error_summary)}")

        created_count = result.get("created", 0)
        failed_count = result.get("failed", 0)

        # Log the sync
        ZoteroSyncLog.objects.create(
            review=review,
            sync_type="push",
            items_processed=created_count,
            success=created_count > 0,
            error_message=f"Created: {created_count}, Failed: {failed_count}"
            if failed_count > 0
            else "",
        )

        return {
            "success": True,
            "pushed": created_count,
            "failed": failed_count,
            "review_id": review_id,
            "errors": result.get("errors") if failed_count > 0 else None,
            "collection_name": review.zotero_collection_name
            if collection_key
            else None,
        }

    except Review.DoesNotExist:
        logger.error(f"Review {review_id} not found")
        return {"success": False, "error": "Review not found", "pushed": 0, "failed": 0}
    except Exception as e:
        logger.exception(f"Error in push task: {str(e)}")

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
            logger.exception(f"Error creating log in push task: {str(e)}")

        # Only retry if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)
        else:
            return {
                "success": False,
                "error": f"Task failed after {self.max_retries} retries: {str(e)}",
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
def pull_references_from_zotero_task(self, review_id: int):
    """Pull references and PDFs from Zotero"""
    try:
        review = Review.objects.get(id=review_id)

        if not review.zotero_library_id or not review.zotero_api_key:
            return {"success": False, "error": "Zotero credentials not configured"}

        zotero = ZoteroService(
            review.zotero_library_id, review.zotero_api_key, review.zotero_library_type
        )

        collection_key = (
            review.zotero_collection_key if review.zotero_collection_key else None
        )

        # Different sync strategies for collection vs library
        if collection_key:
            # For collections: check if this is first sync or if collection has changed
            is_first_sync = (
                review.zotero_collection_last_synced is None
                or Reference.objects.filter(
                    review=review, zotero_key__isnull=False
                ).count()
                == 0
            )

            if is_first_sync:
                logger.info(
                    f"First sync from collection: {review.zotero_collection_name}"
                )
                max_version = 0  # Get all items
            else:
                # For subsequent syncs, still use version to get updates
                from django.db.models import Max

                max_version = (
                    Reference.objects.filter(
                        review=review, zotero_key__isnull=False
                    ).aggregate(Max("zotero_version"))["zotero_version__max"]
                    or 0
                )
                logger.info(
                    f"Incremental sync from collection since version {max_version}"
                )
        else:
            # For entire library, use incremental sync
            from django.db.models import Max

            max_version = (
                Reference.objects.filter(
                    review=review, zotero_key__isnull=False
                ).aggregate(Max("zotero_version"))["zotero_version__max"]
                or 0
            )
            logger.info(f"Incremental sync from library since version {max_version}")

        result = zotero.pull_references_from_zotero(max_version, collection_key)

        if not result["success"]:
            raise self.retry(exc=Exception(result.get("error")), countdown=60)

        items = result["items"]
        pdfs_downloaded = 0
        items_updated = 0
        items_created = 0
        errors = []

        logger.info(f"Processing {len(items)} top-level items from Zotero")

        with transaction.atomic():
            for item in items:
                try:
                    data = item.get("data", {})
                    item_key = data.get("key")
                    item_type = data.get("itemType")

                    if not item_key:
                        continue

                    # Extra safety: skip if somehow an attachment got through
                    if item_type in ["attachment", "note", "annotation"]:
                        logger.warning(
                            f"Skipping {item_type} that shouldn't be in top-level items: {item_key}"
                        )
                        continue

                    logger.info(
                        f"Processing item {item_key} ({item_type}): {data.get('title', 'No title')[:50]}"
                    )

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
                        logger.error(
                            f"Failed to get children for {item_key}: {children_result.get('error')}"
                        )
                        errors.append(f"Item {item_key}: Failed to get attachments")
                        reference.save()
                        if is_new:
                            items_created += 1
                        else:
                            items_updated += 1
                        continue

                    children = children_result["children"]
                    logger.info(f"Item {item_key} has {len(children)} children")

                    # Debug: Log all children
                    for child in children:
                        child_data = child.get("data", {})
                        logger.info(
                            f"  Child: {child_data.get('itemType')} - {child_data.get('contentType')} - {child_data.get('title', 'No title')}"
                        )

                    # Look for PDF attachments
                    pdf_found = False
                    for child in children:
                        child_data = child.get("data", {})

                        if (
                            child_data.get("itemType") == "attachment"
                            and child_data.get("contentType") == "application/pdf"
                        ):
                            if reference.file and reference.file.name:
                                logger.info(
                                    f"Reference {item_key} already has PDF, skipping"
                                )
                                break

                            attachment_key = child_data.get("key")
                            logger.info(
                                f"Downloading PDF attachment {attachment_key} for {item_key}"
                            )

                            pdf_content = zotero.download_pdf_file(attachment_key)

                            if pdf_content:
                                filename = f"{item_key}.pdf"
                                reference.file.save(
                                    filename, ContentFile(pdf_content), save=False
                                )
                                pdfs_downloaded += 1
                                pdf_found = True
                                logger.info(
                                    f"Successfully downloaded PDF for {item_key} ({len(pdf_content)} bytes)"
                                )
                                break
                            else:
                                logger.warning(
                                    f"PDF download returned empty content for {attachment_key}"
                                )

                    if not pdf_found and len(children) > 0:
                        logger.info(
                            f"No PDF found for {item_key} among {len(children)} children"
                        )

                    reference.save()

                    if is_new:
                        items_created += 1
                    else:
                        items_updated += 1

                except Exception as e:
                    errors.append(f"Item {item_key}: {str(e)}")
                    logger.exception(f"Error processing {item_key}")

        # Update collection sync timestamp
        if collection_key:
            review.zotero_collection_last_synced = timezone.now()
            review.save()

        # Log sync
        ZoteroSyncLog.objects.create(
            review=review,
            sync_type="pull",
            items_processed=items_updated + items_created,
            items_with_pdfs=pdfs_downloaded,
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
