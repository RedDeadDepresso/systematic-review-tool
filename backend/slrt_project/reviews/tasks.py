import logging

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.conf import settings

from slrt_project.references.models import ReferenceDuplicatePair
from slrt_project.reviews.models import (
    Review,
    ReviewChatMessage,
    ReviewMember,
    SearchMethod,
)


logger = logging.getLogger(__name__)


def send_review_chat_message(
    review_id, member, message, is_system_message=False, metadata=None
):
    """
    Send a chat message to review and broadcast via WebSocket
    """
    # Save message to database
    chat_message = ReviewChatMessage.objects.create(
        review_id=review_id,
        member=member,
        message=message,
        is_system_message=is_system_message,
        metadata=metadata,
    )

    # Broadcast via WebSocket
    channel_layer = get_channel_layer()

    if not channel_layer:
        logger.warning("Channel layer not available, cannot broadcast message")
        return chat_message

    user_name = "System"
    user_id = None
    member_id = None
    avatar_url = None

    if member:
        user = member.user
        user_name = f"{user.first_name} {user.last_name}".strip() or user.email
        user_id = user.id
        member_id = member.id
        if user.avatar:
            avatar_url = f"{settings.SITE_URL}{settings.MEDIA_URL}{user.avatar.name}"

    async_to_sync(channel_layer.group_send)(
        f"review_{review_id}",
        {
            "type": "chat_message",
            "message_id": chat_message.id,
            "member_id": member_id,
            "user_id": user_id,
            "user_name": user_name,
            "avatar_url": avatar_url,
            "message": message,
            "is_system_message": is_system_message,
            "metadata": metadata,
            "created_at": chat_message.created_at.isoformat(),
        },
    )

    logger.info(f"Sent message to review {review_id}: {message[:50]}")

    return chat_message


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
            review.reference_duplicate_detected = True
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
