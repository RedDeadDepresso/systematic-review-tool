import logging

import bibtexparser
import rispy
from celery import shared_task
from lxml import etree

from slrt_project.references.models import (
    DuplicateClusterManager,
    Reference,
    detect_and_persist_clusters,
)
from slrt_project.reviews.models import (
    Review,
    ReviewMember,
    SearchMethod,
)
from slrt_project.reviews.utils import (
    extract_bibtex_reference_fields,
    extract_endnote_reference_fields,
    extract_ris_reference_fields,
    send_review_chat_message,
)


logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def import_references_task(
    self, review_id: int, member_id: int, search_method_id: int, file_type: str = "bib"
):
    """
    Import BibTeX, RIS, or EndNote XML file and create references

    Args:
        review_id: Review ID
        member_id: ReviewMember ID who triggered import
        search_method_id: SearchMethod ID with the uploaded file
        file_type: 'bib', 'ris', or 'endnote'
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

            search_method.delete()
            return {"success": False, "error": error_msg}

        file_path = search_method.file.path

        logger.info(f"Processing {file_type.upper()} file: {file_path}")

        # Send start message
        file_type_display = (
            "EndNote XML" if file_type == "endnote" else file_type.upper()
        )
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
            # Parse BibTeX file (existing code)
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
            # Parse RIS file (existing code)
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

        elif file_type == "endnote":
            # Parse EndNote XML file
            try:
                tree = etree.parse(file_path)
                root = tree.getroot()

                # EndNote XML has records in <record> tags
                entries = root.findall(".//record")

                if not entries:
                    raise Exception("No records found in EndNote XML file")

            except etree.XMLSyntaxError as e:
                raise Exception(f"Invalid XML format: {str(e)}")
            except Exception as e:
                raise Exception(f"Failed to parse EndNote XML file: {str(e)}")

        else:
            raise Exception(f"Unsupported file type: {file_type}")

        total_entries = len(entries)

        if total_entries == 0:
            error_msg = f"{file_type_display} file is empty"
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

        logger.info(f"Found {total_entries} entries in {file_type_display} file")

        # Create all references at once
        if file_type == "bib":
            references = [
                extract_bibtex_reference_fields(review.id, search_method, entry)
                for entry in entries
            ]
        elif file_type == "ris":
            references = [
                extract_ris_reference_fields(review.id, search_method, entry)
                for entry in entries
            ]
        else:  # endnote
            references = [
                extract_endnote_reference_fields(review.id, search_method, entry)
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
                f"• Format: {file_type_display}\n"
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
    Detect duplicate reference clusters (DOI hard-match + fuzzy similarity).
    """
    member = None
    try:
        review = Review.objects.get(id=review_id)
        member = ReviewMember.objects.select_related("user").get(id=member_id)
        user_name = member.user_name

        send_review_chat_message(
            review_id=review_id,
            member=member,
            message=(
                f"🔍 {user_name} started duplicate detection "
                f"(threshold: {int(threshold * 100)}%)..."
            ),
            is_system_message=True,
            metadata={"action": "detection_started", "threshold": threshold},
        )

        references = Reference.objects.filter(review=review)
        total_references = references.count()

        if total_references == 0:
            review.duplicate_detection_status = (
                Review.DuplicateDetectionStatus.COMPLETED
            )
            review.save()

            send_review_chat_message(
                review_id=review_id,
                member=member,
                message="⚠️ No references found to check for duplicates",
                is_system_message=True,
                metadata={
                    "action": "detection_completed",
                    "clusters_found": 0,
                    "refresh_review": True,
                },
            )
            return {"success": True, "clusters_found": 0}

        logger.info(f"Checking {total_references} references for duplicate clusters")

        stats = detect_and_persist_clusters(
            review,
            queryset=references,
            fuzzy_threshold=threshold,
        )

        clusters_created = stats["clusters_created"]
        logger.info(f"Created {clusters_created} duplicate clusters")

        review.duplicate_detection_status = Review.DuplicateDetectionStatus.COMPLETED
        review.save()

        if clusters_created > 0:
            send_review_chat_message(
                review_id=review_id,
                member=member,
                message=(
                    f"✅ Duplicate detection complete!\n"
                    f"• Found {clusters_created} duplicate clusters\n"
                    f"• Total references: {total_references}\n"
                    f"• Similarity threshold: {int(threshold * 100)}%"
                ),
                is_system_message=True,
                metadata={
                    "action": "detection_completed",
                    "clusters_found": clusters_created,
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
                    f"• No duplicate clusters found\n"
                    f"• Total references: {total_references}\n"
                    f"• Your references appear to be unique!"
                ),
                is_system_message=True,
                metadata={
                    "action": "detection_completed",
                    "clusters_found": 0,
                    "total_references": total_references,
                    "threshold": threshold,
                    "refresh_review": True,
                },
            )

        return {
            "success": True,
            "clusters_found": clusters_created,
            "total_references": total_references,
        }

    except Review.DoesNotExist:
        error_msg = f"Review {review_id} not found"
        logger.error(error_msg)
        return {"success": False, "error": error_msg}

    except Exception as e:
        logger.exception(f"Duplicate detection task error: {e}")

        try:
            send_review_chat_message(
                review_id=review_id,
                member=member,
                message=f"❌ Duplicate detection failed: {e}",
                is_system_message=True,
                metadata={"action": "detection_failed", "error": str(e)},
            )
        except Exception as msg_err:
            logger.exception(f"Failed to send failure message: {msg_err}")

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)

        # Final failure — reset status so the user can retry
        try:
            Review.objects.filter(id=review_id).update(
                duplicate_detection_status=Review.DuplicateDetectionStatus.COMPLETED
            )
        except Exception:
            pass

        return {
            "success": False,
            "error": f"Failed after {self.max_retries} retries: {e}",
        }


@shared_task(bind=True, max_retries=3)
def auto_deduplicate_task(
    self,
    review_id: int,
    member_id: int | None = None,
    confidence_threshold: float = 0.90,
    detect_first: bool = True,
    fuzzy_threshold: float = 0.50,
    doi_clusters_always: bool = True,
    preferred_search_method_id: int | None = None,
):
    """
    Detect duplicate clusters then auto-resolve high-confidence ones.

    Args:
        review_id:                   Review ID.
        member_id:                   ReviewMember who triggered the task (optional).
        confidence_threshold:        Minimum cluster similarity score to auto-resolve.
        detect_first:                Run cluster detection before resolving.
        fuzzy_threshold:             Fuzzy similarity threshold for detection step.
        doi_clusters_always:         Always resolve DOI-matched clusters regardless of score.
        preferred_search_method_id:  Keep references from this search method when available.
    """
    member = None
    try:
        review = Review.objects.get(id=review_id)
        member = (
            ReviewMember.objects.select_related("user").get(id=member_id)
            if member_id
            else None
        )
        user_name = member.user_name if member else "System"

        preferred_source = "any source"
        if preferred_search_method_id:
            try:
                preferred_source = SearchMethod.objects.get(
                    id=preferred_search_method_id
                ).name
            except SearchMethod.DoesNotExist:
                pass

        send_review_chat_message(
            review_id=review_id,
            member=member,
            message=(
                f"🔄 {user_name} started auto-resolution\n"
                f"• Confidence threshold: {int(confidence_threshold * 100)}%\n"
                f"• DOI clusters always resolved: {'yes' if doi_clusters_always else 'no'}\n"
                f"• Preferred source: {preferred_source}"
            ),
            is_system_message=True,
            metadata={
                "action": "deduplication_started",
                "confidence_threshold": confidence_threshold,
                "doi_clusters_always": doi_clusters_always,
                "preferred_search_method_id": preferred_search_method_id,
            },
        )

        manager = DuplicateClusterManager(review, fuzzy_threshold=fuzzy_threshold)
        clusters_created = 0

        # Step 1: Detect clusters (optional)
        if detect_first:
            references = Reference.objects.filter(review=review)
            stats = manager.run(queryset=references)
            clusters_created = stats["clusters_created"]
            logger.info(f"Detection created {clusters_created} clusters")

            if clusters_created > 0:
                send_review_chat_message(
                    review_id=review_id,
                    member=member,
                    message=f"📊 Found {clusters_created} duplicate clusters",
                    is_system_message=True,
                    metadata={
                        "action": "clusters_detected",
                        "clusters_found": clusters_created,
                    },
                )

        # Step 2: Auto-resolve
        result = manager.auto_resolve(
            confidence_threshold=confidence_threshold,
            doi_clusters_always=doi_clusters_always,
            preferred_search_method_id=preferred_search_method_id,
            resolved_by=member,
        )

        auto_resolved = result["auto_resolved"]
        kept = result["kept_references"]
        removed = result["removed_references"]
        logger.info(f"Auto-resolved {auto_resolved} clusters")

        if detect_first and clusters_created > 0:
            review.duplicate_detection_status = (
                Review.DuplicateDetectionStatus.COMPLETED
            )
            review.save()

        if auto_resolved > 0:
            send_review_chat_message(
                review_id=review_id,
                member=member,
                message=(
                    f"✅ Auto-resolution complete!\n"
                    f"• Resolved: {auto_resolved} clusters\n"
                    f"• Kept: {kept} references\n"
                    f"• Removed: {removed} duplicates"
                ),
                is_system_message=True,
                metadata={
                    "action": "deduplication_completed",
                    "clusters_found": clusters_created,
                    "auto_resolved": auto_resolved,
                    "kept_references": kept,
                    "removed_references": removed,
                    "refresh_review": True,
                },
            )
        else:
            send_review_chat_message(
                review_id=review_id,
                member=member,
                message=(
                    f"⚠️ No clusters met the resolution criteria\n"
                    f"• Threshold: {int(confidence_threshold * 100)}%\n"
                    f"Try lowering the threshold or resolve manually."
                ),
                is_system_message=True,
                metadata={
                    "action": "deduplication_completed",
                    "clusters_found": clusters_created,
                    "auto_resolved": 0,
                },
            )

        return {
            "success": True,
            "clusters_found": clusters_created,
            "auto_resolved": auto_resolved,
            "kept_references": kept,
            "removed_references": removed,
        }

    except Exception as e:
        logger.exception(f"Auto-deduplication task error: {e}")

        try:
            send_review_chat_message(
                review_id=review_id,
                member=member,
                message=f"❌ Auto-resolution failed: {e}",
                is_system_message=True,
                metadata={"action": "deduplication_failed", "error": str(e)},
            )
        except Exception:
            pass

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)

        return {
            "success": False,
            "error": f"Failed after {self.max_retries} retries: {e}",
        }
