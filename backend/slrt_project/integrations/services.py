import logging
from typing import Dict, List, Optional

from pyzotero import zotero

from slrt_project.references.models import Reference


logger = logging.getLogger(__name__)


class ZoteroService:
    """Handle all Zotero API interactions using Pyzotero"""

    # Zotero API limits
    MAX_WRITE_BATCH_SIZE = 50  # Maximum items per write request
    MAX_READ_BATCH_SIZE = 100  # Maximum items per read request

    def __init__(self, library_id: str, api_key: str, library_type: str = "user"):
        self.library_id = library_id
        self.library_type = library_type
        self.zot = zotero.Zotero(library_id, library_type, api_key)

    def get_collections(self) -> List[Dict]:
        """Get all collections in the library"""
        try:
            collections = self.zot.collections()
            logger.info(f"Retrieved {len(collections)} collections")
            return collections
        except Exception as e:
            logger.exception(f"Error getting collections: {str(e)}")
            return []

    def get_collection(self, collection_key: str) -> Optional[Dict]:
        """Get a specific collection by key"""
        try:
            collection = self.zot.collection(collection_key)
            return collection
        except Exception as e:
            logger.exception(f"Error getting collection {collection_key}: {str(e)}")
            return None

    def push_references_to_zotero(
        self, references: List["Reference"], collection_key: str = None
    ) -> Dict:
        """
        Push references from your app to Zotero

        WARNING: Zotero API limit is 50 items per request. This method should only
        be called with batches of 50 or fewer items.

        Args:
            references: List of Reference objects to push
            collection_key: Optional collection key to add items to
        """
        if not references:
            return {"success": True, "created": 0, "failed": 0, "items": []}

        # Safety check
        if len(references) > self.MAX_WRITE_BATCH_SIZE:
            logger.warning(
                f"Batch size {len(references)} exceeds Zotero limit of {self.MAX_WRITE_BATCH_SIZE}. "
                f"Only processing first {self.MAX_WRITE_BATCH_SIZE} items."
            )
            references = references[: self.MAX_WRITE_BATCH_SIZE]

        items = []

        for ref in references:
            item_type = self._map_publication_type(ref.publication_type)

            # Build base item
            item = {
                "itemType": item_type,
                "title": ref.title or "Untitled",
                "creators": self._parse_authors(ref.authors),
                "date": ref.publication_date.strftime("%Y-%m-%d")
                if ref.publication_date
                else "",
                "abstractNote": ref.abstract or "",
                "DOI": ref.doi or "",
                "url": ref.url or "",
            }

            # Add publication title field based on item type
            if ref.journal:
                publication_field = self._get_publication_field(item_type)
                if publication_field:
                    item[publication_field] = ref.journal

            # Add to collection if specified
            if collection_key:
                item["collections"] = [collection_key]

            items.append(item)

        logger.info(
            f"Pushing {len(items)} items to Zotero"
            + (f" in collection {collection_key}" if collection_key else "")
        )

        try:
            # Create items in Zotero
            response = self.zot.create_items(items)

            logger.info(
                f"Zotero API response keys: {response.keys() if isinstance(response, dict) else 'Not a dict'}"
            )

            # Handle response format: {'successful': {...}, 'failed': {...}, 'unchanged': {...}}
            if isinstance(response, dict):
                successful = response.get("successful", {})
                failed = response.get("failed", {})
                unchanged = response.get("unchanged", {})

                logger.info(
                    f"Successful: {len(successful)}, Failed: {len(failed)}, Unchanged: {len(unchanged)}"
                )

                # Log failed items for debugging
                if failed:
                    for idx, error in failed.items():
                        logger.error(
                            f"Item {idx} failed: {error.get('message', 'Unknown error')}"
                        )

                # Update references with Zotero keys for successful items
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
                            f"Updated reference {ref.id} with Zotero key {item_data.get('key')}"
                        )

                return {
                    "success": True,
                    "created": success_count,
                    "failed": len(failed),
                    "items": response,
                    "errors": failed if failed else None,
                }
            else:
                logger.error(f"Unexpected response format: {type(response)}")
                return {
                    "success": False,
                    "error": "Unexpected response format from Zotero API",
                    "created": 0,
                    "failed": len(items),
                }

        except Exception as e:
            logger.exception(f"Error creating items in Zotero: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "created": 0,
                "failed": len(items),
            }

    def create_collection(
        self, name: str, parent_collection: str = None
    ) -> Optional[Dict]:
        """
        Create a new collection in Zotero

        Args:
            name: Name of the collection
            parent_collection: Optional parent collection key (for sub-collections)

        Returns:
            Created collection data or None
        """
        try:
            collection_data = [{"name": name, "parentCollection": parent_collection}]

            result = self.zot.create_collections(collection_data)

            if result and isinstance(result, dict):
                successful = result.get("successful", {})
                if successful:
                    # Get the first successful collection
                    first_key = list(successful.keys())[0]
                    return successful[first_key]

            return None

        except Exception as e:
            logger.exception(f"Error creating collection: {str(e)}")
            return None

    def add_items_to_collection(
        self, item_keys: List[str], collection_key: str
    ) -> bool:
        """
        Add existing items to a collection

        Args:
            item_keys: List of Zotero item keys
            collection_key: Collection key to add items to

        Returns:
            True if successful, False otherwise
        """
        try:
            self.zot.addto_collection(collection_key, item_keys)
            logger.info(f"Added {len(item_keys)} items to collection {collection_key}")
            return True
        except Exception as e:
            logger.exception(f"Error adding items to collection: {str(e)}")
            return False

    def _get_publication_field(self, item_type: str) -> Optional[str]:
        """Get the correct publication field name for different item types"""
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
        """Map your publication type to Zotero item type"""
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
        """Convert author string to Zotero creator format with length limits"""
        creators = []
        if not authors_string:
            return creators

        # Handle different author formats
        # Common formats: "Last, First; Last2, First2" or "First Last; First2 Last2"
        author_list = [a.strip() for a in authors_string.split(";")]

        for author in author_list:
            if not author:
                continue

            # Truncate very long author names (Zotero has a limit)
            max_name_length = 100
            if len(author) > max_name_length:
                logger.warning(
                    f"Author name too long ({len(author)} chars), truncating: {author[:50]}..."
                )
                author = author[:max_name_length]

            if "," in author:
                # Format: "Last, First"
                parts = author.split(",", 1)
                last_name = parts[0].strip()
                first_name = parts[1].strip() if len(parts) > 1 else ""

                # Ensure individual name parts aren't too long
                if len(last_name) > 50:
                    last_name = last_name[:50]
                if len(first_name) > 50:
                    first_name = first_name[:50]

                creators.append(
                    {
                        "creatorType": "author",
                        "lastName": last_name,
                        "firstName": first_name,
                    }
                )
            else:
                # Format: "Full Name" or "First Last"
                creators.append(
                    {
                        "creatorType": "author",
                        "name": author[:max_name_length],  # Use single-field mode
                    }
                )

        # Zotero has a limit on total creators
        max_creators = 100
        if len(creators) > max_creators:
            logger.warning(
                f"Too many creators ({len(creators)}), limiting to {max_creators}"
            )
            creators = creators[:max_creators]

        return creators

    def pull_references_from_zotero(
        self, since_version: int = 0, collection_key: str = None
    ) -> Dict:
        """
        Pull top-level references from Zotero

        Args:
            since_version: Only get items modified after this version
            collection_key: Optional collection key to filter items
        """
        try:
            # Get items from specific collection or entire library
            if collection_key:
                logger.info(f"Pulling items from collection {collection_key}")
                if since_version > 0:
                    items = self.zot.collection_items_top(
                        collection_key, since=since_version
                    )
                else:
                    items = self.zot.collection_items_top(collection_key)
            else:
                logger.info("Pulling all top-level items from library")
                if since_version > 0:
                    items = self.zot.top(since=since_version)
                else:
                    items = self.zot.top()

            library_version = self.zot.last_modified_version()

            logger.info(f"Retrieved {len(items)} top-level items from Zotero")

            return {"success": True, "items": items, "library_version": library_version}

        except Exception as e:
            logger.exception(f"Error pulling from Zotero: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "items": [],
                "library_version": since_version,
            }

    def get_item_with_children(self, item_key: str) -> Dict:
        """Get item and its attachments"""
        try:
            # Get the item
            item = self.zot.item(item_key)

            # Get children (attachments, notes)
            children = self.zot.children(item_key)

            logger.info(f"Got {len(children)} children for item {item_key}")

            return {"success": True, "item": item, "children": children}
        except Exception as e:
            logger.exception(f"Error getting item children for {item_key}: {str(e)}")
            return {"success": False, "error": str(e), "item": None, "children": []}

    def download_pdf_file(self, item_key: str) -> Optional[bytes]:
        """Download PDF file from Zotero"""
        try:
            logger.info(f"Attempting to download file for attachment {item_key}")
            # Get the file content
            pdf_content = self.zot.file(item_key)
            logger.info(f"Downloaded {len(pdf_content) if pdf_content else 0} bytes")
            return pdf_content
        except Exception as e:
            logger.exception(f"Error downloading PDF for {item_key}: {str(e)}")
            return None
