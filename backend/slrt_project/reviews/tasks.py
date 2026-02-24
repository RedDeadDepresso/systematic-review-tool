import logging

import bibtexparser
import rispy
from celery import shared_task

from slrt_project.references.models import Reference, ReferenceDuplicatePair
from slrt_project.reviews.models import (
    Review,
    ReviewMember,
    SearchMethod,
)
from slrt_project.reviews.utils import (
    extract_bibtex_reference_fields,
    extract_ris_reference_fields,
    send_review_chat_message,
)


logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def import_references_task(
    self, review_id: int, member_id: int, search_method_id: int, file_type: str = "bib"
):
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

            search_method.delete()
            return {"success": False, "error": error_msg}

        file_path = search_method.file.path

        logger.info(f"Processing {file_type.upper()} file: {file_path}")

        # Send start message
        send_review_chat_message(
            review_id=review_id,
            member=member,
            message=f"📤 {user_name} started importing references from {file_name}...",
            is_system_message=True,
            metadata={
                "action": "import_started",
                "filename": file_name,
                "file_type": file_type,
            },
        )

        # Parse file based on type
        entries = []

        if file_type == "bib":
            # Parse BibTeX file
            try:
                with open(file_path, "r", encoding="utf-8") as bib_file:
                    bib_database = bibtexparser.load(bib_file)
                    entries = bib_database.entries
            except UnicodeDecodeError:
                try:
                    with open(file_path, "r", encoding="latin-1") as bib_file:
                        bib_database = bibtexparser.load(bib_file)
                        entries = bib_database.entries
                except Exception as e:
                    raise Exception(f"Failed to parse BibTeX file: {str(e)}")

        elif file_type == "ris":
            # Parse RIS file
            try:
                with open(file_path, "r", encoding="utf-8") as ris_file:
                    entries = rispy.load(ris_file)
            except UnicodeDecodeError:
                try:
                    with open(file_path, "r", encoding="latin-1") as ris_file:
                        entries = rispy.load(ris_file)
                except Exception as e:
                    raise Exception(f"Failed to parse RIS file: {str(e)}")
            except Exception as e:
                raise Exception(f"Failed to parse RIS file: {str(e)}")
        else:
            raise Exception(f"Unsupported file type: {file_type}")

        total_entries = len(entries)

        if total_entries == 0:
            error_msg = f"{file_type.upper()} file is empty"
            logger.warning(error_msg)

            send_review_chat_message(
                review_id=review_id,
                member=member,
                message=f"⚠️ Import warning: No references found in {file_name}",
                is_system_message=True,
                metadata={"action": "import_failed", "error": error_msg},
            )

            search_method.delete()
            return {"success": False, "error": error_msg}

        logger.info(f"Found {total_entries} entries in {file_type.upper()} file")

        # Create all references at once
        if file_type == "bib":
            references = [
                extract_bibtex_reference_fields(review.id, search_method, entry)
                for entry in entries
            ]
        else:  # ris
            references = [
                extract_ris_reference_fields(review.id, search_method, entry)
                for entry in entries
            ]

        Reference.objects.bulk_create(references)
        created_count = len(references)

        logger.info(f"Imported {created_count} references")

        # Update review flag
        if (
            created_count > 0
            and review.duplicate_detection_status
            != Review.DuplicateDetectionStatus.NOT_STARTED
        ):
            review.duplicate_detection_status = (
                Review.DuplicateDetectionStatus.NOT_STARTED
            )
            review.save()

        # Remove file (django-cleanup will delete it)
        search_method.file = None
        search_method.save()

        metadata = {
            "action": "import_completed",
            "filename": file_name,
            "file_type": file_type,
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
                f"• Format: {file_type.upper()}\n"
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
            "file_type": file_type,
        }

    except SearchMethod.DoesNotExist:
        error_msg = f"SearchMethod {search_method_id} not found"
        logger.error(error_msg)
        return {"success": False, "error": error_msg}

    except Review.DoesNotExist:
        error_msg = f"Review {review_id} not found"
        logger.error(error_msg)

        if search_method:
            search_method.delete()

        return {"success": False, "error": error_msg}

    except Exception as e:
        logger.exception(f"Reference import task error: {str(e)}")

        # Send failure message
        try:
            send_review_chat_message(
                review_id=review_id,
                member=member if "member" in locals() else None,
                message=f"❌ Import failed: {str(e)}",
                is_system_message=True,
                metadata={"action": "import_failed", "error": str(e)},
            )
        except Exception as e:
            logger.error(str(e))

        # Retry on failure
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)
        else:
            # Delete SearchMethod on failure
            if search_method:
                search_method.delete()
            return {
                "success": False,
                "error": f"Failed after {self.max_retries} retries: {str(e)}",
            }


@shared_task(bind=True, max_retries=3)
def detect_duplicates_task(
    self, review_id: int, member_id: int, threshold: float = 0.5
):
    """
    Detect duplicate reference pairs

    Args:
        review_id: Review ID
        member_id: ReviewMember ID who triggered detection
        threshold: Similarity threshold for detecting duplicates
    """
    try:
        review = Review.objects.get(id=review_id)
        member = ReviewMember.objects.select_related("user").get(id=member_id)
        user_name = member.user_name

        # Send start message
        send_review_chat_message(
            review_id=review_id,
            member=member,
            message=f"🔍 {user_name} started duplicate detection (threshold: {int(threshold * 100)}%)...",
            is_system_message=True,
            metadata={"action": "detection_started", "threshold": threshold},
        )

        # Get all references for this review
        references = Reference.objects.filter(review=review)
        total_references = references.count()

        if total_references == 0:
            error_msg = "No references found to check for duplicates"
            logger.warning(error_msg)

            review.duplicate_detection_status = (
                Review.DuplicateDetectionStatus.COMPLETED
            )
            review.save()

            send_review_chat_message(
                review_id=review_id,
                member=member,
                message=f"⚠️ {error_msg}",
                is_system_message=True,
                metadata={
                    "action": "detection_completed",
                    "pairs_found": 0,
                    "refresh_review": True,
                },
            )

            return {"success": True, "pairs_found": 0}

        logger.info(f"Checking {total_references} references for duplicates")

        # Detect duplicate pairs
        pairs_created = ReferenceDuplicatePair.create_pairs(
            review, references, threshold
        )

        logger.info(f"Found {pairs_created} duplicate pairs")

        # Update review status
        review.duplicate_detection_status = Review.DuplicateDetectionStatus.COMPLETED
        review.save()

        # Send completion message
        if pairs_created > 0:
            send_review_chat_message(
                review_id=review_id,
                member=member,
                message=(
                    f"✅ Duplicate detection complete!\n"
                    f"• Found {pairs_created} potential duplicate pairs\n"
                    f"• Total references: {total_references}\n"
                    f"• Similarity threshold: {int(threshold * 100)}%"
                ),
                is_system_message=True,
                metadata={
                    "action": "detection_completed",
                    "pairs_found": pairs_created,
                    "total_references": total_references,
                    "threshold": threshold,
                    "refresh_review": True,
                },
            )
        else:
            send_review_chat_message(
                review_id=review_id,
                member=member,
                message=(
                    f"✅ Duplicate detection complete!\n"
                    f"• No duplicate pairs found\n"
                    f"• Total references: {total_references}\n"
                    f"• Your references appear to be unique!"
                ),
                is_system_message=True,
                metadata={
                    "action": "detection_completed",
                    "pairs_found": 0,
                    "total_references": total_references,
                    "threshold": threshold,
                    "refresh_review": True,
                },
            )

        logger.info(
            f"Successfully completed duplicate detection: {pairs_created} pairs found"
        )

        return {
            "success": True,
            "pairs_found": pairs_created,
            "total_references": total_references,
        }

    except Review.DoesNotExist:
        error_msg = f"Review {review_id} not found"
        logger.error(error_msg)
        return {"success": False, "error": error_msg}

    except Exception as e:
        logger.exception(f"Duplicate detection task error: {str(e)}")

        # Send failure message
        try:
            send_review_chat_message(
                review_id=review_id,
                member=member if "member" in locals() else None,
                message=f"❌ Duplicate detection failed: {str(e)}",
                is_system_message=True,
                metadata={"action": "detection_failed", "error": str(e)},
            )
        except Exception as msg_error:
            logger.exception(f"Failed to send failure message: {msg_error}")

        # Retry on failure
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)
        else:
            # Update review status to failed
            try:
                review = Review.objects.get(id=review_id)
                review.duplicate_detection_status = (
                    Review.DuplicateDetectionStatus.COMPLETED
                )
                review.save()
            except Exception as update_error:
                logger.exception(f"Failed to update review status: {update_error}")

            return {
                "success": False,
                "error": f"Failed after {self.max_retries} retries: {str(e)}",
            }


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
        kept = result["kept_references"]
        removed = result["removed_references"]
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
                    f"• Kept: {kept} references\n"
                    f"• Removed: {removed} duplicates\n"
                    f"• Criteria: {criteria_str}"
                ),
                is_system_message=True,
                metadata={
                    "action": "deduplication_completed",
                    "pairs_found": pairs_created,
                    "auto_resolved": auto_resolved,
                    "confidence_threshold": confidence_threshold,
                    "criteria": criteria,
                    "refresh_review": True,
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
            "kept_references": kept,
            "removed_references": removed,
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
