import logging

from celery import shared_task
from django.core.files.base import ContentFile
from django.utils import timezone

from slrt_project.integrations.services import ZoteroService
from slrt_project.references.models import Reference


logger = logging.getLogger(__name__)


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
