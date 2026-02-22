import logging

import bibtexparser
from celery import shared_task

from slrt_project.references.models import Reference, ReferenceDuplicatePair
from slrt_project.reviews.models import (
    Review,
    ReviewMember,
    SearchMethod,
)
from slrt_project.reviews.utils import (
    extract_reference_fields,
    send_review_chat_message,
)


logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def auto_deduplicate_task(
    self,
    review_id: int,
    member_id: int = None,
    confidence_threshold: float = 0.90,
    create_pairs_first: bool = True,
    criteria: dict = None,
    text_normalization: bool = False,
    preferred_search_method_id: int = None,
):
    """
    Auto-detect and resolve duplicate references

    Args:
        review_id: Review ID
        member_id: ID of ReviewMember who triggered the task
        confidence_threshold: Similarity threshold for auto-resolution
        create_pairs_first: Whether to detect pairs first before resolving
    """
    try:
        review = Review.objects.get(id=review_id)
        member = (
            ReviewMember.objects.select_related("user").get(id=member_id)
            if member_id
            else None
        )
        user_name = member.user_name if member else "System"

        # Parse criteria
        criteria = criteria or {}
        criteria_text = []
        if criteria.get("authors"):
            criteria_text.append("Authors")
        if criteria.get("title"):
            criteria_text.append("Title")
        if criteria.get("journal"):
            criteria_text.append("Journal")
        if criteria.get("year"):
            criteria_text.append("Year")
        if criteria.get("doi"):
            criteria_text.append("DOI")
        if criteria.get("pages"):
            criteria_text.append("Pages")

        criteria_str = ", ".join(criteria_text) if criteria_text else "similarity only"

        # Get preferred search method name
        preferred_source = "any source"
        if preferred_search_method_id:
            try:
                search_method = SearchMethod.objects.get(id=preferred_search_method_id)
                preferred_source = search_method.name
            except SearchMethod.DoesNotExist:
                pass

        # Send start message
        send_review_chat_message(
            review_id=review_id,
            member=member,
            message=(
                f"🔄 {user_name} started systematic auto-resolution\n"
                f"• Threshold: {int(confidence_threshold * 100)}%\n"
                f"• Criteria: {criteria_str}\n"
                f"• Preferred source: {preferred_source}\n"
                f"• Text normalization: {'enabled' if text_normalization else 'disabled'}"
            ),
            is_system_message=True,
            metadata={
                "action": "deduplication_started",
                "confidence_threshold": confidence_threshold,
                "criteria": criteria,
                "text_normalization": text_normalization,
                "preferred_search_method_id": preferred_search_method_id,
            },
        )

        pairs_created = 0

        # Step 1: Find duplicate pairs (if requested)
        if create_pairs_first:
            logger.info(f"Finding duplicate pairs for review {review_id}")

            from .models import Reference

            references = Reference.objects.filter(review=review)

            pairs_created = ReferenceDuplicatePair.create_pairs(
                review, references, threshold=0.5
            )

            logger.info(f"Found {pairs_created} duplicate pairs")

            if pairs_created > 0:
                send_review_chat_message(
                    review_id=review_id,
                    member=member,
                    message=f"📊 Found {pairs_created} potential duplicate pairs",
                    is_system_message=True,
                    metadata={"action": "pairs_detected", "pairs_found": pairs_created},
                )

        # Step 2: Auto-resolve high-confidence pairs with criteria
        logger.info(
            f"Auto-resolving pairs (threshold: {confidence_threshold}, criteria: {criteria})"
        )

        result = ReferenceDuplicatePair.auto_resolve_duplicates(
            review,
            confidence_threshold,
            criteria=criteria,
            text_normalization=text_normalization,
            preferred_search_method_id=preferred_search_method_id,
        )

        auto_resolved = result["auto_resolved"]
        kept_count = len(result["kept_references"])
        removed_count = len(result["removed_references"])

        logger.info(f"Auto-resolved {auto_resolved} pairs")

        # Update review flag
        if create_pairs_first and pairs_created > 0:
            review.duplicate_detection_status = (
                Review.DuplicateDetectionStatus.COMPLETED
            )
            review.save()

        # Send completion message
        if auto_resolved > 0:
            send_review_chat_message(
                review_id=review_id,
                member=member,
                message=(
                    f"✅ Auto-resolution complete!\n"
                    f"• Resolved: {auto_resolved} duplicates\n"
                    f"• Kept: {kept_count} references\n"
                    f"• Removed: {removed_count} duplicates\n"
                    f"• Criteria: {criteria_str}"
                ),
                is_system_message=True,
                metadata={
                    "action": "deduplication_completed",
                    "pairs_found": pairs_created,
                    "auto_resolved": auto_resolved,
                    "kept_references": result["kept_references"],
                    "removed_references": result["removed_references"],
                    "confidence_threshold": confidence_threshold,
                    "criteria": criteria,
                },
            )
        else:
            send_review_chat_message(
                review_id=review_id,
                member=member,
                message=(
                    f"⚠️ No duplicates matched your criteria\n"
                    f"• Threshold: {int(confidence_threshold * 100)}%\n"
                    f"• Criteria: {criteria_str}\n"
                    f"Try adjusting settings or resolve manually"
                ),
                is_system_message=True,
                metadata={
                    "action": "deduplication_completed",
                    "pairs_found": pairs_created,
                    "auto_resolved": 0,
                    "confidence_threshold": confidence_threshold,
                    "criteria": criteria,
                },
            )

        return {
            "success": True,
            "pairs_found": pairs_created,
            "auto_resolved": auto_resolved,
            "kept_references": kept_count,
            "removed_references": removed_count,
        }

    except Exception as e:
        logger.exception(f"Auto-deduplication task error: {str(e)}")

        send_review_chat_message(
            review_id=review_id,
            member=member if "member" in locals() else None,
            message=f"❌ Auto-resolution failed: {str(e)}",
            is_system_message=True,
            metadata={"action": "deduplication_failed", "error": str(e)},
        )

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)
        else:
            return {
                "success": False,
                "error": f"Failed after {self.max_retries} retries: {str(e)}",
            }


@shared_task(bind=True, max_retries=3)
def import_bibtex_task(self, review_id: int, member_id: int, search_method_id: int):
    """
    Import BibTeX file and create references

    Args:
        review_id: Review ID
        member_id: ReviewMember ID who triggered import
        search_method_id: SearchMethod ID with the uploaded file
    """

    search_method = None

    try:
        review = Review.objects.get(id=review_id)
        member = ReviewMember.objects.select_related("user").get(id=member_id)
        search_method = SearchMethod.objects.get(id=search_method_id)

        user_name = member.user_name
        file_name = search_method.name

        # Verify file exists
        if not search_method.file:
            error_msg = "No file attached to SearchMethod"
            logger.error(error_msg)

            send_review_chat_message(
                review_id=review_id,
                member=member,
                message="❌ Import failed: No file found",
                is_system_message=True,
                metadata={"action": "import_failed", "error": error_msg},
            )

            # Delete SearchMethod on failure
            search_method.delete()

            return {"success": False, "error": error_msg}

        file_path = search_method.file.path

        logger.info(f"Processing file: {file_path}")

        # Send start message
        send_review_chat_message(
            review_id=review_id,
            member=member,
            message=f"📤 {user_name} started importing references from {file_name}...",
            is_system_message=True,
            metadata={"action": "import_started", "filename": file_name},
        )

        # Parse BibTeX file
        try:
            with open(file_path, "r", encoding="utf-8") as bib_file:
                bib_database = bibtexparser.load(bib_file)
        except UnicodeDecodeError:
            # Try with different encoding
            try:
                with open(file_path, "r", encoding="latin-1") as bib_file:
                    bib_database = bibtexparser.load(bib_file)
            except Exception as e:
                raise Exception(f"Failed to parse BibTeX file: {str(e)}")

        total_entries = len(bib_database.entries)

        if total_entries == 0:
            error_msg = "BibTeX file is empty"
            logger.warning(error_msg)

            send_review_chat_message(
                review_id=review_id,
                member=member,
                message=f"⚠️ Import warning: No references found in {file_name}",
                is_system_message=True,
                metadata={"action": "import_failed", "error": error_msg},
            )

            # Delete SearchMethod on failure
            search_method.delete()

            return {"success": False, "error": error_msg}

        logger.info(f"Found {total_entries} entries in BibTeX file")

        # Create all references at once
        references = [
            extract_reference_fields(review.id, search_method, entry)
            for entry in bib_database.entries
        ]

        Reference.objects.bulk_create(references)
        created_count = len(references)

        logger.info(f"Imported {created_count} references")

        # Remove file (django-cleanup will delete it)
        search_method.file = None
        search_method.save()

        metadata = {
            "action": "import_completed",
            "filename": file_name,
            "imported_count": created_count,
            "search_method": search_method.name,
        }

        if not SearchMethod.objects.filter(review=review, file__gt="").exists():
            metadata["refresh_review"] = True

        # Send completion message
        send_review_chat_message(
            review_id=review_id,
            member=member,
            message=(
                f"✅ Import complete!\n"
                f"• File: {file_name}\n"
                f"• Imported: {created_count} references\n"
                f"• Source: {search_method.name}"
            ),
            is_system_message=True,
            metadata=metadata,
        )

        logger.info(
            f"Successfully imported {created_count} references from {file_name}"
        )

        return {
            "success": True,
            "imported_count": created_count,
            "search_method": search_method.name,
        }

    except SearchMethod.DoesNotExist:
        error_msg = f"SearchMethod {search_method_id} not found"
        logger.error(error_msg)
        return {"success": False, "error": error_msg}

    except Review.DoesNotExist:
        error_msg = f"Review {review_id} not found"
        logger.error(error_msg)

        # Delete SearchMethod on failure
        if search_method:
            search_method.delete()

        return {"success": False, "error": error_msg}

    except Exception as e:
        logger.exception(f"BibTeX import task error: {str(e)}")

        # Send failure message
        try:
            send_review_chat_message(
                review_id=review_id,
                member=member if "member" in locals() else None,
                message=f"❌ Import failed: {str(e)}",
                is_system_message=True,
                metadata={"action": "import_failed", "error": str(e)},
            )
        except Exception as send_message_error:
            logger.warning(f"Failed to send failure message: {send_message_error}")

        # Delete SearchMethod on failure
        if search_method:
            search_method.delete()

        # Retry on failure
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)
        else:
            return {
                "success": False,
                "error": f"Failed after {self.max_retries} retries: {str(e)}",
            }
