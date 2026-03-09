"""
Utility functions for the reviews app.

Sections
--------
WebSocket messaging
    ``send_review_chat_message`` — persist a ReviewChatMessage and broadcast
    it to the review's WebSocket group via Django Channels.

BibTeX parsing
    ``parse_bibtex_date``, ``extract_bibtex_reference_fields`` — convert a
    bibtexparser entry dict into an unsaved Reference.

RIS parsing
    ``parse_ris_date``, ``extract_ris_reference_fields`` — convert a rispy
    entry dict into an unsaved Reference.

EndNote XML parsing
    ``parse_endnote_date``, ``get_endnote_text``, ``get_endnote_authors``,
    ``extract_endnote_reference_fields`` — convert an lxml Element (<record>)
    into an unsaved Reference.

Miscellaneous
    ``strip_ansi`` — remove ANSI escape sequences from a string.
"""

import logging
import re
from datetime import date

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings

from slrt_project.references.models import Reference
from slrt_project.reviews.models import ReviewChatMessage


logger = logging.getLogger(__name__)


# ===========================================================================
# WebSocket messaging
# ===========================================================================


def send_review_chat_message(
    review_id: int,
    member,
    message: str,
    is_system_message: bool = False,
    metadata: dict | None = None,
):
    """
    Persist a ReviewChatMessage and broadcast it to the review's WebSocket group.

    The message is always saved to the database first.  The WebSocket broadcast
    is a best-effort operation — if the channel layer is unavailable (e.g. in
    tests that don't configure Redis) a warning is logged and the saved message
    is returned without raising.

    Args:
        review_id:         PK of the Review this message belongs to.
        member:            ReviewMember who sent the message, or ``None`` for
                           system-generated messages.
        message:           Human-readable message text.
        is_system_message: Mark the message as a system notification.
        metadata:          Arbitrary JSON-serialisable dict attached to the
                           message (e.g. ``{"action": "import_completed"}``).

    Returns:
        The saved ReviewChatMessage instance.
    """
    chat_message = ReviewChatMessage.objects.create(
        review_id=review_id,
        member=member,
        message=message,
        is_system_message=is_system_message,
        metadata=metadata,
    )

    channel_layer = get_channel_layer()

    if not channel_layer:
        logger.warning("Channel layer not available, cannot broadcast message")
        return chat_message

    # Build sender identity for the WebSocket payload.
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

    logger.info("Sent message to review %s: %s", review_id, message[:50])

    return chat_message


# ===========================================================================
# BibTeX parsing utilities
# ===========================================================================

# Map three-letter BibTeX month abbreviations to integers.
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

# Map BibTeX entry types to our internal publication type strings.
PUBLICATION_TYPES = {
    "article": "Journal Article",
    "book": "Book",
    "inproceedings": "Conference Paper",
    "phdthesis": "PhD Thesis",
    "mastersthesis": "Master's Thesis",
    "techreport": "Technical Report",
    "misc": "Miscellaneous",
}


def parse_bibtex_date(entry: dict) -> date | None:
    """
    Extract a publication date from a BibTeX entry dict.

    Tries fields in this order:
    1. ``date`` — ISO-style string (``"YYYY"`` or ``"YYYY-MM"`` or
       ``"YYYY-MM-DD"``).  Splits on ``"-"`` and passes to ``date()``.
    2. ``year`` + optional ``month`` — ``month`` is matched against
       ``BIBTEX_MONTHS``; defaults to January when absent or unrecognised.

    Returns ``None`` when neither ``date`` nor ``year`` is present, or when
    the value cannot be parsed as an integer.
    """
    # Prefer ISO-style date string if present.
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

    month_str = entry.get("month")
    if month_str:
        # Normalise to lowercase three-letter prefix (e.g. "January" → "jan").
        month = BIBTEX_MONTHS.get(month_str.lower()[:3], 1)
    else:
        month = 1

    return date(year, month, 1)


def extract_bibtex_reference_fields(
    review_id: int, search_method, entry: dict
) -> Reference:
    """
    Convert a bibtexparser entry dict into an unsaved Reference.

    Normalises DOIs by stripping ``"doi:"`` prefixes and ``"https://doi.org/"``
    base URLs so all stored DOIs are in plain ``10.xxxx/yyyy`` form.

    Args:
        review_id:     PK of the owning Review.
        search_method: SearchMethod instance for the import.
        entry:         Dict from ``bibtexparser.load().entries``.

    Returns:
        Unsaved Reference instance (not yet written to the DB).
    """
    publication_type = PUBLICATION_TYPES.get(
        entry.get("ENTRYTYPE", "").lower(), "Other"
    )
    publication_date = parse_bibtex_date(entry)

    # BibTeX stores multiple authors joined by " and ".
    authors = (
        ", ".join(a.strip() for a in entry.get("author", "").split(" and "))
        if "author" in entry
        else ""
    )

    # Journal name falls back to booktitle (conference proceedings).
    journal = entry.get("journal") or entry.get("booktitle") or ""
    article_customizations = entry.get("note") or entry.get("howpublished")

    doi = _normalise_doi(entry.get("doi") or entry.get("DOI", ""))
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


# ===========================================================================
# RIS parsing utilities
# ===========================================================================

# Map RIS type codes to our internal publication type strings.
RIS_PUBLICATION_TYPES = {
    "JOUR": "Journal Article",
    "BOOK": "Book",
    "CHAP": "Book Chapter",
    "CONF": "Conference Paper",
    "THES": "Thesis",
    "RPRT": "Technical Report",
    "GEN": "Miscellaneous",
}


def parse_ris_date(entry: dict) -> date | None:
    """
    Extract a publication date from a rispy entry dict.

    RIS uses ``Y1`` for the primary date, which rispy maps to ``"year"`` or
    ``"publication_year"``.  Month extraction is not attempted because RIS
    month fields are inconsistently populated across databases.

    Returns ``None`` when no year field is present or the value is non-numeric.
    """
    year_str = entry.get("year") or entry.get("publication_year")
    if not year_str:
        return None

    try:
        year = int(year_str)
    except (ValueError, TypeError):
        return None

    return date(year, 1, 1)


def extract_ris_reference_fields(
    review_id: int, search_method, entry: dict
) -> Reference:
    """
    Convert a rispy entry dict into an unsaved Reference.

    Args:
        review_id:     PK of the owning Review.
        search_method: SearchMethod instance for the import.
        entry:         Dict from ``rispy.load()``.

    Returns:
        Unsaved Reference instance.
    """
    publication_type = RIS_PUBLICATION_TYPES.get(
        entry.get("type_of_reference", "GEN"), "Miscellaneous"
    )
    publication_date = parse_ris_date(entry)

    # rispy stores authors as a list under ``"authors"`` or ``"first_authors"``.
    authors_list = entry.get("authors") or entry.get("first_authors") or []
    authors = ", ".join(authors_list) if authors_list else ""

    # Journal name can appear in several fields depending on the exporting database.
    journal = (
        entry.get("journal_name")
        or entry.get("secondary_title")
        or entry.get("alternate_title3")
        or ""
    )

    doi = _normalise_doi(entry.get("doi", ""))

    # URL may be a plain string or a list; normalise to a single string.
    url_raw = entry.get("url") or (
        entry.get("urls", [""])[0] if entry.get("urls") else ""
    )
    url = url_raw or ""

    # Page range — build from start/end pages when available.
    start_page = entry.get("start_page", "")
    end_page = entry.get("end_page", "")
    pages = f"{start_page}-{end_page}" if start_page and end_page else start_page or ""

    # Title falls back through several field names.
    title = (
        entry.get("title")
        or entry.get("primary_title")
        or (
            entry["titles"][0]
            if entry.get("titles") and isinstance(entry["titles"], list)
            else None
        )
        or "No Title"
    )

    return Reference(
        review_id=review_id,
        title=title,
        publication_type=publication_type,
        authors=authors,
        journal=journal,
        search_method=search_method,
        article_customizations=entry.get("notes") or "",
        abstract=entry.get("abstract", ""),
        doi=doi,
        url=url,
        publication_date=publication_date,
        pages=pages,
    )


# ===========================================================================
# EndNote XML parsing utilities
# ===========================================================================


def parse_endnote_date(record) -> date | None:
    """
    Extract a publication date from an EndNote XML ``<record>`` element.

    Looks for ``<dates><year>`` and optionally ``<dates><month>``.

    Returns ``None`` when no year element is found or its text is non-numeric.
    """
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

    month = 1
    month_elem = dates.find(".//month")
    if month_elem is not None and month_elem.text:
        try:
            month = int(month_elem.text)
        except (ValueError, TypeError):
            pass

    return date(year, month, 1)


def get_endnote_text(record, path: str) -> str:
    """
    Safely retrieve the text of an XML element at ``path`` within ``record``.

    Returns an empty string when the element is absent or has no text content,
    so callers never need to guard against ``None``.
    """
    elem = record.find(path)
    return elem.text if elem is not None and elem.text else ""


def get_endnote_authors(record) -> str:
    """
    Extract a comma-separated author string from an EndNote XML ``<record>``.

    Checks ``<contributors><authors>`` first; falls back to
    ``<contributors><secondary-authors>`` when the primary list is empty.
    """
    authors = []
    contributors = record.find(".//contributors")

    if contributors is not None:
        authors_section = contributors.find(".//authors")
        if authors_section is not None:
            for author in authors_section.findall(".//author"):
                if author.text:
                    authors.append(author.text)

        # Fall back to secondary authors if no primary authors were found.
        if not authors:
            secondary_authors = contributors.find(".//secondary-authors")
            if secondary_authors is not None:
                for author in secondary_authors.findall(".//author"):
                    if author.text:
                        authors.append(author.text)

    return ", ".join(authors)


def extract_endnote_reference_fields(
    review_id: int, search_method, record
) -> Reference:
    """
    Convert an lxml ``<record>`` element into an unsaved Reference.

    Args:
        review_id:     PK of the owning Review.
        search_method: SearchMethod instance for the import.
        record:        ``lxml.etree.Element`` for a single ``<record>`` node.

    Returns:
        Unsaved Reference instance.
    """
    # Reference type lives in a <ref-type name="..."> attribute.
    ref_type_elem = record.find(".//ref-type")
    ref_type_name = (
        ref_type_elem.get("name") if ref_type_elem is not None else "Miscellaneous"
    )

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

    # Primary title with fallback to secondary title.
    titles = record.find(".//titles")
    title = ""
    if titles is not None:
        title_elem = titles.find(".//title")
        if title_elem is not None and title_elem.text:
            title = title_elem.text

        if not title:
            secondary = titles.find(".//secondary-title")
            if secondary is not None and secondary.text:
                title = secondary.text

    if not title:
        title = "No Title"

    authors = get_endnote_authors(record)

    # Journal/periodical full title.
    journal = ""
    periodical = record.find(".//periodical")
    if periodical is not None:
        full_title = periodical.find(".//full-title")
        if full_title is not None and full_title.text:
            journal = full_title.text

    pages_elem = record.find(".//pages")
    pages = pages_elem.text if pages_elem is not None and pages_elem.text else ""

    doi = _normalise_doi(get_endnote_text(record, ".//electronic-resource-num"))

    # URL is nested: <urls><related-urls><url>.
    url = ""
    urls = record.find(".//urls")
    if urls is not None:
        related_urls = urls.find(".//related-urls")
        if related_urls is not None:
            url_elem = related_urls.find(".//url")
            if url_elem is not None and url_elem.text:
                url = url_elem.text

    return Reference(
        review_id=review_id,
        title=title,
        publication_type=publication_type,
        authors=authors,
        journal=journal,
        search_method=search_method,
        article_customizations=get_endnote_text(record, ".//notes"),
        abstract=get_endnote_text(record, ".//abstract"),
        doi=doi,
        url=url,
        publication_date=parse_endnote_date(record),
        pages=pages,
    )


# ===========================================================================
# Miscellaneous
# ===========================================================================

ANSI_ESCAPE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")


def strip_ansi(text: str) -> str:
    """Strip ANSI escape sequences (colour codes, cursor movement, etc.) from text."""
    return ANSI_ESCAPE.sub("", text)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _normalise_doi(doi: str) -> str:
    """
    Strip common DOI prefixes so all stored values are bare ``10.xxxx/yyyy``.

    Handles ``"doi:"`` prefix (case-insensitive) and full ``https://doi.org/``
    URLs.  Returns an empty string for falsy input.
    """
    if not doi:
        return ""
    return doi.lower().replace("doi:", "").replace("https://doi.org/", "").strip()
