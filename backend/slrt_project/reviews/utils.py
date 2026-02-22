import logging
import re
from datetime import date

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings

from slrt_project.references.models import Reference
from slrt_project.reviews.models import ReviewChatMessage


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


# ---- bibtex parsing utilities ----
BIBTEX_MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

PUBLICATION_TYPES = {
    "article": "Journal Article",
    "book": "Book",
    "inproceedings": "Conference Paper",
    "phdthesis": "PhD Thesis",
    "mastersthesis": "Master's Thesis",
    "techreport": "Technical Report",
    "misc": "Miscellaneous",
}


def parse_bibtex_date(entry):
    """Parse date from BibTeX entry"""
    raw_date = entry.get("date")
    if raw_date:
        try:
            parts = [int(p) for p in raw_date.split("-")]
            return date(*parts)
        except Exception:
            pass

    year = entry.get("year")
    if not year:
        return None

    try:
        year = int(year)
    except ValueError:
        return None

    month = entry.get("month")
    if month:
        month = month.lower()[:3]
        month = BIBTEX_MONTHS.get(month, 1)
    else:
        month = 1

    return date(year, month, 1)


def extract_reference_fields(review_id, search_method, entry):
    """Extract reference fields from BibTeX entry"""
    publication_type = PUBLICATION_TYPES.get(
        entry.get("ENTRYTYPE", "").lower(), "Other"
    )

    publication_date = parse_bibtex_date(entry)

    authors = (
        ", ".join(a.strip() for a in entry.get("author", "").split(" and "))
        if "author" in entry
        else ""
    )

    journal = entry.get("journal") or entry.get("booktitle") or ""
    article_customizations = entry.get("note") or entry.get("howpublished")

    doi = entry.get("doi") or entry.get("DOI", "")
    if doi:
        doi = doi.lower().replace("doi:", "").replace("https://doi.org/", "").strip()

    url = entry.get("url") or entry.get("URL", "")

    return Reference(
        review_id=review_id,
        title=entry.get("title", "No Title"),
        publication_type=publication_type,
        authors=authors,
        journal=journal,
        search_method=search_method,
        article_customizations=article_customizations or "",
        abstract=entry.get("abstract", ""),
        doi=doi,
        url=url,
        publication_date=publication_date,
        pages=entry.get("pages", ""),
    )


# ----  Ansi escape code stripping utility ----
ANSI_ESCAPE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")


def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE.sub("", text)
