"""
Service layer for all Zotero API interactions.

This module wraps the pyzotero library in a single class so the rest of the
codebase never imports pyzotero directly.  All public methods return plain
dicts so callers are decoupled from the pyzotero response format.

ZoteroService
    Constructor accepts the same three credentials used by pyzotero.Zotero
    and stores a configured client as ``self.zot``.

Public methods
--------------
get_collections()           → list[dict]
get_collection(key)         → dict | None
push_references_to_zotero() → dict  (success/created/failed summary)
create_collection()         → dict | None
add_items_to_collection()   → bool
pull_references_from_zotero() → dict  (success/items/library_version)
get_item_with_children()    → dict  (item + children list)
download_pdf_file()         → bytes | None

Private helpers
---------------
_get_publication_field(item_type) → str | None
_map_publication_type(pub_type)   → str
_parse_authors(authors_string)    → list[dict]
"""

import logging
from typing import Dict, List, Optional

from pyzotero import zotero

from slrt_project.references.models import Reference


logger = logging.getLogger(__name__)


# ===========================================================================
# ZoteroService
# ===========================================================================


class ZoteroService:
    """
    Thin wrapper around the pyzotero library.
    """

    # Zotero hard limits — do not raise these; they are enforced by the API.
    MAX_WRITE_BATCH_SIZE = 50  # Maximum items per create_items() call.
    MAX_READ_BATCH_SIZE = (
        100  # Maximum items per read call (top, collection_items_top).
    )

    def __init__(self, library_id: str, api_key: str, library_type: str = "user"):
        """
        Initialise the pyzotero client.

        Parameters
        ----------
        library_id : str
            Zotero User ID (for personal libraries) or Group ID.
        api_key : str
            Decrypted Zotero API key (never the encrypted column value).
        library_type : str
            'user' for personal libraries, 'group' for group libraries.
        """
        self.library_id = library_id
        self.library_type = library_type
        # self.zot is the pyzotero client — patch this in tests to avoid
        # real HTTP calls.
        self.zot = zotero.Zotero(library_id, library_type, api_key)

    # ── Collection operations ─────────────────────────────────────────────

    def get_collections(self) -> List[Dict]:
        """
        Return all collections in the Zotero library.

        Returns an empty list on error so the caller can still render a UI
        without crashing.
        """
        try:
            collections = self.zot.collections()
            logger.info("Retrieved %d collections", len(collections))
            return collections
        except Exception as e:
            logger.exception("Error getting collections: %s", e)
            return []

    def get_collection(self, collection_key: str) -> Optional[Dict]:
        """
        Return metadata for a single collection by its Zotero key.

        Returns None when the collection does not exist or the API call fails.
        """
        try:
            return self.zot.collection(collection_key)
        except Exception as e:
            logger.exception("Error getting collection %s: %s", collection_key, e)
            return None

    def create_collection(
        self, name: str, parent_collection: str = None
    ) -> Optional[Dict]:
        """
        Create a new Zotero collection.

        The pyzotero ``create_collections`` method accepts a list and returns
        a ``successful`` / ``failed`` dict.  We extract the first successful
        entry and return it, or None on failure.

        Parameters
        ----------
        name : str
            Human-readable collection name.
        parent_collection : str | None
            Zotero key of the parent collection for nested collections.
            Pass None to create a top-level collection.
        """
        try:
            result = self.zot.create_collections(
                [{"name": name, "parentCollection": parent_collection}]
            )
            if result and isinstance(result, dict):
                successful = result.get("successful", {})
                if successful:
                    # Only one collection was submitted, so there is exactly
                    # one entry in ``successful``; grab whichever key it has.
                    first_key = list(successful.keys())[0]
                    return successful[first_key]
            return None
        except Exception as e:
            logger.exception("Error creating collection: %s", e)
            return None

    def add_items_to_collection(
        self, item_keys: List[str], collection_key: str
    ) -> bool:
        """
        Add existing Zotero items to a collection.

        Parameters
        ----------
        item_keys : list[str]
            Zotero item keys to add.
        collection_key : str
            Target collection key.

        Returns True on success, False on any error.
        """
        try:
            self.zot.addto_collection(collection_key, item_keys)
            logger.info(
                "Added %d items to collection %s", len(item_keys), collection_key
            )
            return True
        except Exception as e:
            logger.exception("Error adding items to collection: %s", e)
            return False

    # ── Push (local → Zotero) ─────────────────────────────────────────────

    def push_references_to_zotero(
        self, references: List["Reference"], collection_key: str = None
    ) -> Dict:
        """
        Push a batch of local Reference objects to Zotero.

        The Zotero API accepts at most MAX_WRITE_BATCH_SIZE (50) items per
        request.  If more are passed the batch is silently truncated and a
        warning is logged — the caller (the Celery task) is responsible for
        chunking correctly.

        After a successful API call the method updates each Reference row with
        the Zotero-assigned ``key`` and ``version`` so subsequent pushes can
        detect which items have already been synced.

        Parameters
        ----------
        references : list[Reference]
            Reference instances to push.  Must already be saved (need PKs).
        collection_key : str | None
            When set, newly created Zotero items are added to this collection.

        Returns
        -------
        dict with keys:
            success  (bool)   — False only on a total API failure.
            created  (int)    — Number of items Zotero accepted.
            failed   (int)    — Number of items Zotero rejected.
            items    (any)    — Raw pyzotero response for debugging.
            errors   (dict | None) — Per-item error details from Zotero, or None.
        """
        if not references:
            return {"success": True, "created": 0, "failed": 0, "items": []}

        # Enforce the write-batch limit with a warning rather than an error so
        # the caller still gets a partial result instead of an exception.
        if len(references) > self.MAX_WRITE_BATCH_SIZE:
            logger.warning(
                "Batch size %d exceeds Zotero limit of %d. "
                "Only processing first %d items.",
                len(references),
                self.MAX_WRITE_BATCH_SIZE,
                self.MAX_WRITE_BATCH_SIZE,
            )
            references = references[: self.MAX_WRITE_BATCH_SIZE]

        # Build the pyzotero item payload for each reference.
        items = []
        for ref in references:
            item_type = self._map_publication_type(ref.publication_type)
            item = {
                "itemType": item_type,
                "title": ref.title or "Untitled",
                "creators": self._parse_authors(ref.authors),
                # Format date as ISO 8601 if present; empty string otherwise.
                "date": (
                    ref.publication_date.strftime("%Y-%m-%d")
                    if ref.publication_date
                    else ""
                ),
                "abstractNote": ref.abstract or "",
                "DOI": ref.doi or "",
                "url": ref.url or "",
            }

            # The publication/journal field name differs by item type (e.g.
            # "publicationTitle" for journal articles vs "proceedingsTitle"
            # for conference papers).
            if ref.journal:
                publication_field = self._get_publication_field(item_type)
                if publication_field:
                    item[publication_field] = ref.journal

            # Assign to collection when provided — Zotero uses a list because
            # an item can belong to multiple collections.
            if collection_key:
                item["collections"] = [collection_key]

            items.append(item)

        logger.info(
            "Pushing %d items to Zotero%s",
            len(items),
            f" in collection {collection_key}" if collection_key else "",
        )

        try:
            response = self.zot.create_items(items)

            logger.info(
                "Zotero API response keys: %s",
                response.keys() if isinstance(response, dict) else type(response),
            )

            if isinstance(response, dict):
                # Zotero returns three buckets: successful, failed, unchanged.
                successful = response.get("successful", {})
                failed = response.get("failed", {})
                unchanged = response.get("unchanged", {})

                logger.info(
                    "Successful: %d, Failed: %d, Unchanged: %d",
                    len(successful),
                    len(failed),
                    len(unchanged),
                )

                # Log each failed item so engineers can diagnose them.
                for idx, error in failed.items():
                    logger.error(
                        "Item %s failed: %s",
                        idx,
                        error.get("message", "Unknown error"),
                    )

                # Write Zotero key + version back onto each successfully
                # created reference so the next push skips them.
                success_count = 0
                for idx_str, item_data in successful.items():
                    idx = int(idx_str)
                    if idx < len(references):
                        ref = references[idx]
                        ref.zotero_key = item_data.get("key")
                        ref.zotero_version = item_data.get("version", 0)
                        ref.save()
                        success_count += 1
                        logger.info(
                            "Updated reference %s with Zotero key %s",
                            ref.id,
                            item_data.get("key"),
                        )

                return {
                    "success": True,
                    "created": success_count,
                    "failed": len(failed),
                    "items": response,
                    # None instead of {} so callers can do a simple truthiness check.
                    "errors": failed if failed else None,
                }
            else:
                # pyzotero returned something unexpected — surface it clearly.
                logger.error("Unexpected response format: %s", type(response))
                return {
                    "success": False,
                    "error": "Unexpected response format from Zotero API",
                    "created": 0,
                    "failed": len(items),
                }

        except Exception as e:
            logger.exception("Error creating items in Zotero: %s", e)
            return {
                "success": False,
                "error": str(e),
                "created": 0,
                "failed": len(items),
            }

    # ── Pull (Zotero → local) ─────────────────────────────────────────────

    def pull_references_from_zotero(
        self, since_version: int = 0, collection_key: str = None
    ) -> Dict:
        """
        Fetch top-level items from the Zotero library.

        «Top-level» means parent items only — attachments and notes that
        are children of a parent are excluded.  This matches the typical
        literature-review use-case where each paper is one Reference.

        Parameters
        ----------
        since_version : int
            Zotero library version number.  When > 0 only items modified
            after this version are returned (incremental sync).  Pass 0
            to fetch all items.
        collection_key : str | None
            When set, restricts results to items in that collection.

        Returns
        -------
        dict with keys:
            success         (bool)
            items           (list[dict]) — raw pyzotero item dicts.
            library_version (int)        — current library version from the API.
            error           (str)        — present only on failure.
        """
        try:
            if collection_key:
                logger.info("Pulling items from collection %s", collection_key)
                # ``collection_items_top`` returns only top-level items inside
                # the collection, not attachments or notes.
                items = (
                    self.zot.collection_items_top(collection_key, since=since_version)
                    if since_version > 0
                    else self.zot.collection_items_top(collection_key)
                )
            else:
                logger.info("Pulling all top-level items from library")
                items = (
                    self.zot.top(since=since_version)
                    if since_version > 0
                    else self.zot.top()
                )

            # ``last_modified_version`` is a lightweight HEAD request and tells
            # us the version number to store for the next incremental sync.
            library_version = self.zot.last_modified_version()
            logger.info("Retrieved %d top-level items from Zotero", len(items))
            return {"success": True, "items": items, "library_version": library_version}

        except Exception as e:
            logger.exception("Error pulling from Zotero: %s", e)
            return {
                "success": False,
                "error": str(e),
                "items": [],
                # Return the input version so the caller can store it unchanged
                # and retry without losing the last successful sync point.
                "library_version": since_version,
            }

    def get_item_with_children(self, item_key: str) -> Dict:
        """
        Fetch a Zotero item and all its children (attachments and notes).

        Children are fetched in a separate API call because pyzotero's
        ``item()`` method does not include them.

        Returns
        -------
        dict with keys:
            success  (bool)
            item     (dict | None)  — the parent item.
            children (list[dict])   — attachment/note items.
        """
        try:
            item = self.zot.item(item_key)
            children = self.zot.children(item_key)
            logger.info("Got %d children for item %s", len(children), item_key)
            return {"success": True, "item": item, "children": children}
        except Exception as e:
            logger.exception("Error getting item children for %s: %s", item_key, e)
            return {"success": False, "error": str(e), "item": None, "children": []}

    def download_pdf_file(self, item_key: str) -> Optional[bytes]:
        """
        Download the file attached to a Zotero attachment item.

        The ``item_key`` here is the key of the *attachment* child, not the
        parent item.  Returns None on any error so callers can skip to the
        next attachment without crashing.
        """
        try:
            logger.info("Attempting to download file for attachment %s", item_key)
            pdf_content = self.zot.file(item_key)
            logger.info("Downloaded %d bytes", len(pdf_content) if pdf_content else 0)
            return pdf_content
        except Exception as e:
            logger.exception("Error downloading PDF for %s: %s", item_key, e)
            return None

    # ── Private helpers ───────────────────────────────────────────────────

    def _get_publication_field(self, item_type: str) -> Optional[str]:
        """
        Return the correct Zotero field name for the journal/publication title
        for a given item type.

        Zotero uses different field names per item type — for example
        ``publicationTitle`` for journal articles but ``proceedingsTitle`` for
        conference papers.  Returns None for item types that have no
        publication field (e.g. ``book``), so the caller can skip the
        assignment entirely.
        """
        publication_fields = {
            "journalArticle": "publicationTitle",
            "conferencePaper": "proceedingsTitle",
            "bookSection": "bookTitle",
            "magazineArticle": "publicationTitle",
            "newspaperArticle": "publicationTitle",
            "thesis": "university",
            "report": "institution",
            "webpage": "websiteTitle",
            "blogPost": "blogTitle",
            "forumPost": "forumTitle",
            "podcast": "seriesTitle",
            "videoRecording": "studio",
            "tvBroadcast": "network",
            "radioBroadcast": "network",
        }
        return publication_fields.get(item_type)

    def _map_publication_type(self, pub_type: str) -> str:
        """
        Convert a local publication type string to a Zotero itemType.

        Comparison is case-insensitive.  Unknown types default to
        ``journalArticle`` so Zotero always receives a valid value.
        """
        if not pub_type:
            return "journalArticle"

        mapping = {
            "journal article": "journalArticle",
            "conference paper": "conferencePaper",
            "conference proceeding": "conferencePaper",
            "book": "book",
            "book chapter": "bookSection",
            "thesis": "thesis",
            "dissertation": "thesis",
            "report": "report",
            "preprint": "preprint",
            "webpage": "webpage",
            "magazine article": "magazineArticle",
            "newspaper article": "newspaperArticle",
        }
        return mapping.get(pub_type.lower(), "journalArticle")

    def _parse_authors(self, authors_string: str) -> List[Dict]:
        """
        Convert a semicolon-separated author string to pyzotero creator dicts.

        Supports two common formats:
            "Last, First; Last2, First2"  — split on first comma → lastName/firstName
            "First Last; First2 Last2"    — no comma → single ``name`` field

        Both individual name parts and the total creator list are truncated
        before sending to Zotero because the API enforces length limits.
        """
        creators = []
        if not authors_string:
            return creators

        author_list = [a.strip() for a in authors_string.split(";")]

        for author in author_list:
            if not author:
                continue

            # Zotero rejects names longer than ~100 characters.
            max_name_length = 100
            if len(author) > max_name_length:
                logger.warning(
                    "Author name too long (%d chars), truncating: %s...",
                    len(author),
                    author[:50],
                )
                author = author[:max_name_length]

            if "," in author:
                # "Last, First" format — split on first comma only.
                parts = author.split(",", 1)
                last_name = parts[0].strip()[:50]
                first_name = parts[1].strip()[:50] if len(parts) > 1 else ""
                creators.append(
                    {
                        "creatorType": "author",
                        "lastName": last_name,
                        "firstName": first_name,
                    }
                )
            else:
                # Single-string format — use Zotero's single-field mode.
                creators.append(
                    {
                        "creatorType": "author",
                        "name": author[:max_name_length],
                    }
                )

        # Zotero imposes a hard limit on the number of creators per item.
        max_creators = 100
        if len(creators) > max_creators:
            logger.warning(
                "Too many creators (%d), limiting to %d", len(creators), max_creators
            )
            creators = creators[:max_creators]

        return creators
