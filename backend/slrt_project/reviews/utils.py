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


def extract_bibtex_reference_fields(review_id, search_method, entry):
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


# ---- ris parsing utilities ----

# RIS type mapping
RIS_PUBLICATION_TYPES = {
    "JOUR": "Journal Article",
    "BOOK": "Book",
    "CHAP": "Book Chapter",
    "CONF": "Conference Paper",
    "THES": "Thesis",
    "RPRT": "Technical Report",
    "GEN": "Miscellaneous",
}


def parse_ris_date(entry):
    """Parse date from RIS entry"""
    # RIS uses Y1 for primary date
    year_str = entry.get("year") or entry.get("publication_year")

    if not year_str:
        return None

    try:
        year = int(year_str)
    except (ValueError, TypeError):
        return None

    # Try to get month if available
    month = 1

    return date(year, month, 1)


def extract_ris_reference_fields(review_id, search_method, entry):
    """Extract reference fields from RIS entry"""
    publication_type = RIS_PUBLICATION_TYPES.get(
        entry.get("type_of_reference", "GEN"), "Miscellaneous"
    )

    publication_date = parse_ris_date(entry)

    # RIS authors are in 'authors' field as a list
    authors_list = entry.get("authors") or entry.get("first_authors") or []
    authors = ", ".join(authors_list) if authors_list else ""

    # Journal can be in various fields
    journal = (
        entry.get("journal_name")
        or entry.get("secondary_title")
        or entry.get("alternate_title3")
        or ""
    )

    # Notes
    article_customizations = entry.get("notes") or ""

    # DOI
    doi = entry.get("doi", "")
    if doi:
        doi = doi.lower().replace("doi:", "").replace("https://doi.org/", "").strip()

    # URL
    url = entry.get("url") or entry.get("urls", [""])[0] if entry.get("urls") else ""

    # Abstract
    abstract = entry.get("abstract", "")

    # Title - try multiple fields
    title = entry.get("title")

    if not title:
        title = entry.get("primary_title")

    if not title:
        titles = entry.get("titles")
        if titles and isinstance(titles, list):
            title = titles[0]

    if not title:
        title = "No Title"

    # Pages - can be start_page + end_page or just pages
    start_page = entry.get("start_page", "")
    end_page = entry.get("end_page", "")
    pages = f"{start_page}-{end_page}" if start_page and end_page else start_page or ""

    return Reference(
        review_id=review_id,
        title=title,
        publication_type=publication_type,
        authors=authors,
        journal=journal,
        search_method=search_method,
        article_customizations=article_customizations,
        abstract=abstract,
        doi=doi,
        url=url,
        publication_date=publication_date,
        pages=pages,
    )


# ---- EndNote XML parsing utilities ----
def parse_endnote_date(record):
    """Parse date from EndNote XML record"""
    dates = record.find(".//dates")
    if dates is None:
        return None

    year_elem = dates.find(".//year")
    if year_elem is None or not year_elem.text:
        return None

    try:
        year = int(year_elem.text)
    except (ValueError, TypeError):
        return None

    # Try to get month
    month = 1
    month_elem = dates.find(".//month")
    if month_elem is not None and month_elem.text:
        try:
            month = int(month_elem.text)
        except (ValueError, TypeError):
            pass

    return date(year, month, 1)


def get_endnote_text(record, path):
    """Safely get text from EndNote XML element"""
    elem = record.find(path)
    return elem.text if elem is not None and elem.text else ""


def get_endnote_authors(record):
    """Extract authors from EndNote XML record"""
    authors = []
    contributors = record.find(".//contributors")

    if contributors is not None:
        # Try authors first
        authors_section = contributors.find(".//authors")
        if authors_section is not None:
            for author in authors_section.findall(".//author"):
                if author.text:
                    authors.append(author.text)

        # If no authors, try secondary-authors
        if not authors:
            secondary_authors = contributors.find(".//secondary-authors")
            if secondary_authors is not None:
                for author in secondary_authors.findall(".//author"):
                    if author.text:
                        authors.append(author.text)

    return ", ".join(authors)


def extract_endnote_reference_fields(review_id, search_method, record):
    """Extract reference fields from EndNote XML record"""
    # Get reference type
    ref_type_elem = record.find(".//ref-type")
    ref_type_name = (
        ref_type_elem.get("name") if ref_type_elem is not None else "Miscellaneous"
    )

    # Map EndNote types to our types
    endnote_type_map = {
        "Journal Article": "Journal Article",
        "Book": "Book",
        "Book Section": "Book Chapter",
        "Conference Paper": "Conference Paper",
        "Conference Proceedings": "Conference Paper",
        "Thesis": "Thesis",
        "Report": "Technical Report",
    }

    publication_type = endnote_type_map.get(ref_type_name, "Miscellaneous")

    # Get titles
    titles = record.find(".//titles")
    title = ""
    if titles is not None:
        title_elem = titles.find(".//title")
        if title_elem is not None and title_elem.text:
            title = title_elem.text

        # Fallback to secondary-title if no primary title
        if not title:
            secondary_title = titles.find(".//secondary-title")
            if secondary_title is not None and secondary_title.text:
                title = secondary_title.text

    if not title:
        title = "No Title"

    # Get authors
    authors = get_endnote_authors(record)

    # Get journal/periodical
    periodical = record.find(".//periodical")
    journal = ""
    if periodical is not None:
        full_title = periodical.find(".//full-title")
        if full_title is not None and full_title.text:
            journal = full_title.text

    # Get pages
    pages_elem = record.find(".//pages")
    pages = pages_elem.text if pages_elem is not None and pages_elem.text else ""

    # Get DOI
    doi = get_endnote_text(record, ".//electronic-resource-num")
    if doi:
        doi = doi.lower().replace("doi:", "").replace("https://doi.org/", "").strip()

    # Get URL
    urls = record.find(".//urls")
    url = ""
    if urls is not None:
        related_urls = urls.find(".//related-urls")
        if related_urls is not None:
            url_elem = related_urls.find(".//url")
            if url_elem is not None and url_elem.text:
                url = url_elem.text

    # Get abstract
    abstract = get_endnote_text(record, ".//abstract")

    # Get notes
    notes = get_endnote_text(record, ".//notes")

    # Get date
    publication_date = parse_endnote_date(record)

    return Reference(
        review_id=review_id,
        title=title,
        publication_type=publication_type,
        authors=authors,
        journal=journal,
        search_method=search_method,
        article_customizations=notes,
        abstract=abstract,
        doi=doi,
        url=url,
        publication_date=publication_date,
        pages=pages,
    )


# ----  Ansi escape code stripping utility ----
ANSI_ESCAPE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")


def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE.sub("", text)
