"""
Celery tasks for reference import and duplicate detection.

Tasks
-----
import_references_task       Parse a BibTeX, RIS, or EndNote XML file and bulk-create
                             Reference rows for a given review.
detect_duplicates_task       Scan a review's references for duplicate clusters using
                             DOI hard-matching and fuzzy title similarity.
auto_deduplicate_task        Optionally detect clusters then auto-resolve high-confidence
                             ones without user intervention.

Each task is ``bind=True`` so it can access ``self.request.retries`` / ``self.retry()``.
All three retry up to ``max_retries=3`` with a 60-second countdown on unexpected errors.

Helper utilities for parsing BibTeX / RIS / EndNote XML live in
``slrt_project.reviews.utils`` — these tasks only orchestrate file I/O,
DB writes, and WebSocket notifications.
"""

import logging

import bibtexparser
import rispy
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
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


# ===========================================================================
# Reference import task
# ===========================================================================


@shared_task(bind=True, max_retries=3)
def import_references_task(
    self,
    review_id: int,
    member_id: int,
    search_method_id: int,
    file_type: str = "bib",
):
    """
    Parse an uploaded reference file and bulk-create Reference rows.

    Supports three file formats, selected via ``file_type``:
      - ``"bib"``     — BibTeX (.bib)
      - ``"ris"``     — RIS (.ris)
      - ``"endnote"`` — EndNote XML (.xml)

    Flow
    ----
    1. Load Review, ReviewMember, and SearchMethod from the DB.
    2. Verify the SearchMethod has an attached file.
    3. Parse the file into a list of raw entries using the appropriate parser.
    4. Convert each entry into an unsaved Reference via the corresponding
       ``extract_*_reference_fields`` utility, then bulk-create all at once.
    5. If any references were created and duplicate detection was previously
       run, reset ``duplicate_detection_status`` to NOT_STARTED so the user
       knows the new references haven't been checked yet.
    6. Clear the file from the SearchMethod (django-cleanup deletes it from
       storage), then send a WebSocket completion message.

    On hard failures (after exhausting retries) the SearchMethod is deleted
    to avoid orphaned upload records.

    Args:
        review_id:         PK of the Review the references belong to.
        member_id:         PK of the ReviewMember who triggered the import.
        search_method_id:  PK of the SearchMethod that holds the uploaded file.
        file_type:         ``"bib"``, ``"ris"``, or ``"endnote"``.

    Returns:
        dict with ``success`` bool and either ``imported_count`` or ``error``.
    """
    search_method = None

    try:
        review = Review.objects.get(id=review_id)
        member = ReviewMember.objects.select_related("user").get(id=member_id)
        search_method = SearchMethod.objects.get(id=search_method_id)

        user_name = member.user_name
        file_name = search_method.name

        # ── Guard: file must be present before we attempt parsing ─────────
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

        logger.info("Processing %s file: %s", file_type.upper(), file_path)

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

        # ── Parse file ────────────────────────────────────────────────────
        entries = _parse_file(file_type, file_path)

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

        logger.info("Found %d entries in %s file", total_entries, file_type_display)

        # ── Convert entries → unsaved Reference objects ───────────────────
        extractor = _get_extractor(file_type)
        references = [extractor(review.id, search_method, entry) for entry in entries]

        Reference.objects.bulk_create(references)
        created_count = len(references)

        logger.info("Imported %d references", created_count)

        # ── Reset duplicate detection status if previously completed ──────
        # New references haven't been checked yet, so the old result is stale.
        if (
            created_count > 0
            and review.duplicate_detection_status
            != Review.DuplicateDetectionStatus.NOT_STARTED
        ):
            review.duplicate_detection_status = (
                Review.DuplicateDetectionStatus.NOT_STARTED
            )
            review.save()

        # ── Clear file from SearchMethod (django-cleanup removes from storage) ─
        search_method.file = None
        search_method.save()

        metadata = {
            "action": "import_completed",
            "filename": file_name,
            "file_type": file_type,
            "imported_count": created_count,
            "search_method": search_method.name,
        }

        # Signal the frontend to refresh the review if this was the last
        # pending import (no other SearchMethods still have files attached).
        if not SearchMethod.objects.filter(review=review, file__gt="").exists():
            metadata["refresh_review"] = True

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
            "Successfully imported %d references from %s", created_count, file_name
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
        logger.exception("Reference import task error: %s", e)

        # Best-effort failure notification — member may not be in locals yet
        # if the failure happened before ReviewMember was fetched.
        try:
            send_review_chat_message(
                review_id=review_id,
                member=member if "member" in locals() else None,
                message=f"❌ Import failed: {e}",
                is_system_message=True,
                metadata={"action": "import_failed", "error": str(e)},
            )
        except Exception as notify_err:
            logger.error("Failed to send import failure message: %s", notify_err)

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)

        # Exhausted retries — clean up the SearchMethod to avoid orphans.
        if search_method:
            search_method.delete()

        return {
            "success": False,
            "error": f"Failed after {self.max_retries} retries: {e}",
        }


# ===========================================================================
# Duplicate detection task
# ===========================================================================


@shared_task(bind=True, max_retries=3)
def detect_duplicates_task(
    self,
    review_id: int,
    member_id: int,
    threshold: float = 0.5,
):
    """
    Scan a review's references for duplicate clusters.

    Uses a two-pass strategy implemented in ``detect_and_persist_clusters``:
      1. Hard match on normalised DOI (exact equality).
      2. Fuzzy similarity on title + author strings at ``threshold`` (0–1).

    After detection ``review.duplicate_detection_status`` is set to COMPLETED
    regardless of whether any clusters were found, so the UI can show the
    result.

    Args:
        review_id:   PK of the Review to scan.
        member_id:   PK of the ReviewMember who triggered the task.
        threshold:   Minimum fuzzy similarity score (default 0.5 = 50 %).

    Returns:
        dict with ``success`` bool, ``clusters_found`` count, and optionally
        ``total_references``.
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

        # ── Short-circuit: nothing to check ───────────────────────────────
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

        logger.info("Checking %d references for duplicate clusters", total_references)

        stats = detect_and_persist_clusters(
            review,
            queryset=references,
            fuzzy_threshold=threshold,
        )

        clusters_created = stats["clusters_created"]
        logger.info("Created %d duplicate clusters", clusters_created)

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
        logger.exception("Duplicate detection task error: %s", e)

        try:
            send_review_chat_message(
                review_id=review_id,
                member=member,
                message=f"❌ Duplicate detection failed: {e}",
                is_system_message=True,
                metadata={"action": "detection_failed", "error": str(e)},
            )
        except Exception as notify_err:
            logger.exception("Failed to send detection failure message: %s", notify_err)

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)

        # Reset status so the user can retry via the UI.
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


# ===========================================================================
# Auto-deduplication task
# ===========================================================================


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

    This task combines the detection and resolution steps into a single
    operation intended for scheduled or bulk-import workflows.  Manual
    per-cluster resolution is still available in the UI.

    Step 1 — Detection (when ``detect_first=True``)
        Runs ``DuplicateClusterManager.run()`` to identify duplicate clusters.
        Uses ``fuzzy_threshold`` for the similarity pass.

    Step 2 — Auto-resolution
        Calls ``DuplicateClusterManager.auto_resolve()`` which keeps one
        reference per cluster (preferring ``preferred_search_method_id`` when
        supplied) and deletes the rest.  Only clusters with a similarity score
        ≥ ``confidence_threshold`` are resolved automatically; lower-confidence
        clusters are left for manual review.  DOI-matched clusters are always
        resolved when ``doi_clusters_always=True``.

    Args:
        review_id:                   PK of the Review to process.
        member_id:                   PK of the ReviewMember who triggered the
                                     task, or ``None`` for system-initiated runs.
        confidence_threshold:        Minimum score to auto-resolve (default 0.90).
        detect_first:                Run detection before resolving (default True).
        fuzzy_threshold:             Fuzzy similarity threshold for detection.
        doi_clusters_always:         Always resolve DOI-matched clusters regardless
                                     of their score (default True).
        preferred_search_method_id:  When resolving, keep references from this
                                     search method over others where possible.

    Returns:
        dict with ``success`` bool, ``clusters_found``, ``auto_resolved``,
        ``kept_references``, and ``removed_references`` counts.
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

        # Resolve the preferred source name for the notification message.
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

        # ── Step 1: Detect clusters ───────────────────────────────────────
        if detect_first:
            references = Reference.objects.filter(review=review)
            stats = manager.run(queryset=references)
            clusters_created = stats["clusters_created"]
            logger.info("Detection created %d clusters", clusters_created)

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

        # ── Step 2: Auto-resolve ──────────────────────────────────────────
        result = manager.auto_resolve(
            confidence_threshold=confidence_threshold,
            doi_clusters_always=doi_clusters_always,
            preferred_search_method_id=preferred_search_method_id,
            resolved_by=member,
        )

        auto_resolved = result["auto_resolved"]
        kept = result["kept_references"]
        removed = result["removed_references"]
        logger.info("Auto-resolved %d clusters", auto_resolved)

        # Mark detection as complete if we ran it and found something.
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
        logger.exception("Auto-deduplication task error: %s", e)

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


# ===========================================================================
# Private helpers
# ===========================================================================


def _parse_file(file_type: str, file_path: str) -> list:
    """
    Parse a reference file and return a list of raw entries.

    BibTeX and RIS parsing tries UTF-8 first, falling back to latin-1 on a
    UnicodeDecodeError.  Both parsers raise a plain Exception (not a Celery
    retry) so the outer task handler can decide whether to retry.

    Args:
        file_type:  ``"bib"``, ``"ris"``, or ``"endnote"``.
        file_path:  Absolute path to the file on disk.

    Returns:
        List of entries.  For BibTeX/RIS these are dicts; for EndNote XML they
        are ``lxml.etree.Element`` objects (one per ``<record>`` tag).

    Raises:
        Exception: Propagated to the calling task for retry handling.
    """
    if file_type == "bib":
        return _parse_bibtex(file_path)
    elif file_type == "ris":
        return _parse_ris(file_path)
    elif file_type == "endnote":
        return _parse_endnote(file_path)
    else:
        raise Exception(f"Unsupported file type: {file_type}")


def _parse_bibtex(file_path: str) -> list:
    """Parse a BibTeX file, retrying with latin-1 on a UTF-8 decode error."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return bibtexparser.load(f).entries
    except UnicodeDecodeError:
        try:
            with open(file_path, "r", encoding="latin-1") as f:
                return bibtexparser.load(f).entries
        except Exception as e:
            raise Exception(f"Failed to parse BibTeX file: {e}")


def _parse_ris(file_path: str) -> list:
    """Parse a RIS file, retrying with latin-1 on a UTF-8 decode error."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return rispy.load(f)
    except UnicodeDecodeError:
        try:
            with open(file_path, "r", encoding="latin-1") as f:
                return rispy.load(f)
        except Exception as e:
            raise Exception(f"Failed to parse RIS file: {e}")
    except Exception as e:
        raise Exception(f"Failed to parse RIS file: {e}")


def _parse_endnote(file_path: str) -> list:
    """
    Parse an EndNote XML file and return the ``<record>`` elements.

    EndNote XML wraps all records in a ``<records>`` block; each ``<record>``
    child element maps to one reference.
    """
    try:
        root = etree.parse(file_path).getroot()
        records = root.findall(".//record")
        if not records:
            raise Exception("No records found in EndNote XML file")
        return records
    except etree.XMLSyntaxError as e:
        raise Exception(f"Invalid XML format: {e}")
    except Exception as e:
        raise Exception(f"Failed to parse EndNote XML file: {e}")


def _get_extractor(file_type: str):
    """
    Return the field-extraction callable for a given file type.

    Each extractor takes ``(review_id, search_method, entry)`` and returns an
    unsaved ``Reference`` instance ready for ``bulk_create``.
    """
    extractors = {
        "bib": extract_bibtex_reference_fields,
        "ris": extract_ris_reference_fields,
        "endnote": extract_endnote_reference_fields,
    }
    # _parse_file guards against unsupported types before we get here, so
    # this lookup will always succeed for the three known types.
    return extractors[file_type]


@shared_task
def send_review_invitation_email(email, review_title, invited_by_email, role):
    frontend_url = settings.FRONTEND_BASE_URL

    subject = f"You've been invited to a review: {review_title}"

    message = f"""
Hi,

You've been invited by {invited_by_email} to join the review "{review_title}" as a {role}.

To accept the invitation:
1. Go to {frontend_url}
2. Log in or create an account using this email ({email})
3. Once logged in, you'll see the invitation.

If you don't have an account yet, please sign up using the same email.

Thanks!
"""

    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [email],
        fail_silently=False,
    )
