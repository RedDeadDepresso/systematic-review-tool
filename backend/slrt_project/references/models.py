"""
Models for the references app.

Domain overview
---------------
A Reference is a bibliographic record (paper, report, etc.) imported from a
BibTeX, RIS, or EndNote file via a SearchMethod.  References flow through
several stages:

    Import → Screening → Full-Text Review → Extraction

Duplicate detection runs as a background task and groups similar references
into ReferenceCluster objects.  Each cluster is resolved either automatically
(high-confidence) or manually by a review member.

Model inventory
---------------
Label                   — user-owned colour-coded tag applied to references
Reference               — core bibliographic record
ReferenceLabel          — many-to-many junction: (Reference, Label, ReviewMember)
UploadedPDF             — a PDF uploaded for matching against references
ReferenceCluster        — a group of duplicate (or near-duplicate) references
ReferenceClusterMember  — membership of a Reference in a ReferenceCluster
Reason                  — named exclusion reason (per review)
ReferenceOpinion        — a single member's verdict on a reference at one stage
Keyword                 — inclusion / exclusion keyword for full-text search
Note                    — free-text note left by a member on a reference

Utility classes (not models)
-----------------------------
UnionFind               — weighted quick-union used by the duplicate detector
DuplicateClusterDetector — finds clusters via DOI hard-match + pg_trgm fuzzy match
DuplicateClusterManager  — orchestrates detection, persistence, and auto-resolution
"""

import uuid

from django.contrib.postgres.indexes import GinIndex, OpClass
from django.contrib.postgres.search import SearchVectorField
from django.db import connection, models, transaction
from django.db.models import Case, CharField, Count, Func, Max, Value, When
from django.db.models.functions import Lower
from django.utils import timezone


# ===========================================================================
# Label
# ===========================================================================


class Label(models.Model):
    """
    A colour-coded tag owned by a single user and applied to references.

    Labels are personal — each user maintains their own set.  The
    ``unique_label_per_user`` constraint prevents duplicate names for the
    same user while allowing different users to create identically-named labels.

    ``hotkey`` is an optional keyboard shortcut string used by the frontend
    to apply the label quickly during screening.
    """

    user = models.ForeignKey("users.User", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    color = models.CharField(max_length=50, default="#3b82f6")
    hotkey = models.CharField(max_length=30, blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name"],
                name="unique_label_per_user",
            )
        ]


# ===========================================================================
# Reference
# ===========================================================================


def reference_upload_path(instance, filename):
    """
    Generate a UUID-based storage path for reference PDF attachments.

    Using a UUID prefix prevents collisions and avoids exposing the original
    filename in the URL.
    """
    return f"references/{uuid.uuid4()}/{filename}"


class ReferenceOpinionStatus(models.TextChoices):
    """Possible verdicts a reviewer can assign to a reference."""

    UNDECIDED = "undecided", "Undecided"
    EXCLUDED = "excluded", "Excluded"
    MAYBE = "maybe", "Maybe"
    INCLUDED = "included", "Included"


class Reference(models.Model):
    """
    A bibliographic record belonging to a review.

    Lifecycle
    ---------
    1. Imported via a SearchMethod (BibTeX / RIS / EndNote).
    2. Screened: members assign opinions (included/excluded/maybe).
       The denormalised ``screening_status`` is updated asynchronously via
       ``update_opinion_statuses``.
    3. Promoted to full-text review (``in_full_text=True``) then extraction
       (``in_extraction=True``).
    4. Duplicate detection groups identical records into ReferenceCluster
       objects.  Duplicates are soft-deleted by setting ``duplicate_status``
       to DELETED — they are never physically removed.

    Search
    ------
    ``search_vector`` is a PostgreSQL tsvector column updated by a DB trigger.
    A GIN index makes full-text queries fast.  A trigram index on ``title``
    (gin_trgm_ops) powers the fuzzy duplicate-detection similarity query.

    Zotero integration
    ------------------
    ``zotero_key`` / ``zotero_version`` / ``last_synced`` track the record's
    identity in a linked Zotero library.
    """

    class DuplicateStatus(models.TextChoices):
        UNRESOLVED = "unresolved", "Unresolved"
        DELETED = "deleted", "Deleted"
        NOT_DUPLICATE = "not_duplicate", "Not Duplicate"
        RESOLVED = "resolved", "Resolved"
        UNIQUE = "unique", "Unique"

    # ------------------------------------------------------------------
    # Core bibliographic fields
    # ------------------------------------------------------------------

    review = models.ForeignKey("reviews.Review", on_delete=models.CASCADE)
    title = models.TextField()
    publication_type = models.CharField(max_length=255)
    publication_date = models.DateField(null=True, blank=True)
    authors = models.TextField()
    journal = models.CharField(max_length=255)
    search_method = models.ForeignKey("reviews.SearchMethod", on_delete=models.CASCADE)
    article_customizations = models.CharField(max_length=255)
    abstract = models.TextField(blank=True)
    doi = models.CharField(max_length=255, blank=True)
    url = models.URLField(max_length=500, blank=True)
    pages = models.CharField(max_length=50, blank=True, default="")

    # ------------------------------------------------------------------
    # Attached PDF
    # ------------------------------------------------------------------

    file = models.FileField(
        upload_to=reference_upload_path,
        blank=True,
        null=True,
        max_length=255,
        help_text="PDF attachment, if any.",
    )

    # ------------------------------------------------------------------
    # Full-text search
    # ------------------------------------------------------------------

    # Populated by a DB trigger; never written from Python directly.
    search_vector = SearchVectorField(null=True, blank=True)

    # ------------------------------------------------------------------
    # Assignment & workflow flags
    # ------------------------------------------------------------------

    # Which reviewer this reference is currently assigned to (optional).
    assignee = models.ForeignKey(
        "reviews.ReviewMember",
        null=True,
        on_delete=models.SET_NULL,
        help_text="The reviewer this reference is currently assigned to.",
    )
    duplicate_status = models.CharField(
        max_length=20,
        choices=DuplicateStatus.choices,
        default=DuplicateStatus.UNIQUE,
    )
    in_full_text = models.BooleanField(
        default=False,
        help_text="True once the reference has been promoted to the full-text stage.",
    )
    in_extraction = models.BooleanField(
        default=False,
        help_text="True once the reference has been promoted to the extraction stage.",
    )
    is_extraction_completed = models.BooleanField(default=False)

    # ------------------------------------------------------------------
    # Denormalised opinion status
    # Updated by Reference.update_opinion_statuses() after each opinion change.
    # ------------------------------------------------------------------

    screening_status = models.CharField(
        max_length=20,
        blank=True,
        default=ReferenceOpinionStatus.UNDECIDED,
        help_text="Aggregated screening verdict (updated by update_opinion_statuses).",
    )
    full_text_status = models.CharField(
        max_length=20,
        blank=True,
        default=ReferenceOpinionStatus.UNDECIDED,
        help_text="Aggregated full-text verdict (updated by update_opinion_statuses).",
    )

    # ------------------------------------------------------------------
    # Zotero sync fields
    # ------------------------------------------------------------------

    zotero_key = models.CharField(max_length=100, blank=True, null=True)
    zotero_version = models.IntegerField(default=0)
    last_synced = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            # Full-text search index.
            GinIndex(fields=["search_vector"], name="reference_search_vector_idx"),
            # Trigram similarity index used by the duplicate detector.
            GinIndex(
                OpClass(Lower("title"), "gin_trgm_ops"),
                name="reference_title_trgm_idx",
            ),
        ]
        constraints = [
            # Prevent the same Zotero key appearing twice in one review.
            models.UniqueConstraint(
                fields=["review", "zotero_key"],
                name="unique_zotero_key_per_review",
                condition=models.Q(zotero_key__isnull=False),
            )
        ]

    # ------------------------------------------------------------------
    # Class methods
    # ------------------------------------------------------------------

    @classmethod
    def update_opinion_statuses(cls, reference_ids=None, stage=None):
        """
        Recompute and persist the denormalised opinion-status field for the
        given references at the given stage.

        Rules
        -----
        - Zero opinions → UNDECIDED.
        - All opinions agree → use that status (INCLUDED / EXCLUDED / MAYBE).
        - Conflicting opinions → UNDECIDED (reviewers disagree; needs resolution).

        This method is called after every ``bulk-upsert`` so that the screening
        list view can filter by ``screening_status`` / ``full_text_status``
        without a subquery per row.

        Args:
            reference_ids: Optional list of Reference PKs to restrict the
                           update.  When ``None``, all references are updated.
            stage:         Must be ``ReferenceOpinion.Stage.SCREENING`` or
                           ``ReferenceOpinion.Stage.FULL_TEXT``.

        Raises:
            ValueError: When ``stage`` is not one of the two valid choices.
        """
        if stage not in [
            ReferenceOpinion.Stage.SCREENING,
            ReferenceOpinion.Stage.FULL_TEXT,
        ]:
            raise ValueError("Invalid stage")

        refs_qs = cls.objects.all()
        if reference_ids:
            refs_qs = refs_qs.filter(id__in=reference_ids)

        # Aggregate opinion counts per reference in one DB round-trip.
        opinions = (
            ReferenceOpinion.objects.filter(
                reference_id__in=refs_qs.values_list("id", flat=True),
                stage=stage,
            )
            .values("reference_id")
            .annotate(
                distinct_count=Count("status", distinct=True),
                max_status=Max("status"),
            )
        )

        status_map: dict[int, str] = {}
        for op in opinions:
            if op["distinct_count"] == 0:
                # No opinions yet.
                effective_status = ReferenceOpinionStatus.UNDECIDED
            elif op["distinct_count"] == 1:
                # All reviewers agree — use that status directly.
                effective_status = op["max_status"]
            else:
                # Mixed opinions — fall back to UNDECIDED until conflict is resolved.
                effective_status = ReferenceOpinionStatus.UNDECIDED

            status_map[op["reference_id"]] = effective_status

        # Any reference without opinions gets UNDECIDED.
        all_ids = set(refs_qs.values_list("id", flat=True))
        for ref_id in all_ids:
            if ref_id not in status_map:
                status_map[ref_id] = ReferenceOpinionStatus.UNDECIDED

        # Single bulk UPDATE using a CASE expression.
        when_statements = [
            When(id=ref_id, then=Value(status_val))
            for ref_id, status_val in status_map.items()
        ]

        update_field = (
            "full_text_status"
            if stage == ReferenceOpinion.Stage.FULL_TEXT
            else "screening_status"
        )

        refs_qs.update(
            **{
                update_field: Case(
                    *when_statements,
                    default=Value(ReferenceOpinionStatus.UNDECIDED),
                    output_field=CharField(),
                )
            }
        )

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def has_pdf(self) -> bool:
        """True when a PDF file is attached to this reference."""
        return bool(self.file)

    def __str__(self) -> str:
        return f"{self.review_id} {self.id} {self.title}"


# ===========================================================================
# ReferenceLabel
# ===========================================================================


class ReferenceLabel(models.Model):
    """
    Associates a Label with a Reference, recording which ReviewMember applied it.

    The ``unique_label_assignment`` constraint ensures that each label can only
    be attached to a given reference once — a second application by a different
    member would silently overwrite (via ``get_or_create``) rather than create
    a duplicate.
    """

    reference = models.ForeignKey(
        Reference,
        on_delete=models.CASCADE,
        related_name="labels",
    )
    label = models.ForeignKey(
        Label,
        on_delete=models.CASCADE,
        related_name="reference_labels",
    )
    # The member who applied the label (for audit).
    member = models.ForeignKey("reviews.ReviewMember", on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["reference", "label"],
                name="unique_label_assignment",
            )
        ]


# ===========================================================================
# UploadedPDF
# ===========================================================================


class ImmutableUnaccent(Func):
    """
    Wraps the ``immutable_unaccent`` PostgreSQL function so it can be used
    inside queryset annotations and subqueries.

    The immutable variant is required for use in expression indexes.
    """

    function = "immutable_unaccent"
    arity = 1


class UploadedPDF(models.Model):
    """
    A PDF uploaded by a reviewer for later attachment to a Reference.

    The auto-match endpoint attempts to pair uploaded PDFs with references via
    DOI match, exact normalised title match, and trigram similarity (in that
    order).  Once matched, the UploadedPDF row is deleted to free storage.
    """

    review = models.ForeignKey(
        "reviews.Review",
        on_delete=models.CASCADE,
        related_name="uploaded_pdfs",
    )
    file = models.FileField(upload_to="uploaded_pdfs/", max_length=255)
    # Display name (populated from the filename without extension by the view).
    name = models.TextField()
    # DOI extracted from the first page of the PDF (null when not found).
    doi = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["doi"]),
            # A GIN trgm index on ``name`` is created via RunSQL in the migration
            # because Django's index classes don't support expression indexes
            # for text_pattern_ops.
        ]

    def __str__(self) -> str:
        return f"{self.name}.pdf"


# ===========================================================================
# ReferenceCluster
# ===========================================================================


class ReferenceCluster(models.Model):
    """
    A group of duplicate (or near-duplicate) references within a review.

    Lifecycle
    ---------
    1. Created by ``DuplicateClusterManager.run()`` when duplicates are detected.
       All member references receive ``duplicate_status = UNRESOLVED``.
    2. Resolved either automatically (via ``auto_resolve``) or manually (via
       ``manually_resolve``).  The winning reference receives
       ``duplicate_status = RESOLVED``; the losers get ``DELETED``.
    3. A cluster may be dismissed as a false positive — all members revert to
       ``NOT_DUPLICATE``.

    The ``doi_match`` flag distinguishes hard-matched clusters (exact DOI) from
    fuzzy similarity clusters.  Hard-matched clusters are considered high-confidence
    and are always auto-resolved when ``doi_clusters_always=True``.

    ``max_similarity_score`` stores the highest pairwise similarity in the cluster
    so the UI can sort clusters by confidence.
    """

    class Status(models.TextChoices):
        UNRESOLVED = "unresolved", "Unresolved"
        AUTO_RESOLVED = "auto_resolved", "Auto-Resolved"
        MANUALLY_RESOLVED = "manually_resolved", "Manually Resolved"
        DISMISSED = "dismissed", "Dismissed"

    # UUID primary key: cluster IDs are exposed in the API and a UUID is harder
    # to enumerate than a sequential integer.
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    review = models.ForeignKey(
        "reviews.Review",
        on_delete=models.CASCADE,
        related_name="duplicate_clusters",
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.UNRESOLVED,
        db_index=True,
    )
    # Set when resolved — the reference we decided to keep.
    canonical_reference = models.ForeignKey(
        "references.Reference",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="canonical_in_clusters",
    )
    # Highest pairwise similarity score across all pairs in the cluster.
    max_similarity_score = models.FloatField(default=0.0)
    # True when every member was matched via DOI (hard match).
    doi_match = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        "reviews.ReviewMember",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="resolved_clusters",
    )

    class Meta:
        app_label = "references"
        indexes = [
            models.Index(fields=["review", "status"]),
            models.Index(fields=["review", "doi_match"]),
        ]

    def __str__(self) -> str:
        return f"Cluster {self.id} ({self.status})"

    @property
    def size(self) -> int:
        """Number of references in this cluster."""
        return self.members.count()


# ===========================================================================
# ReferenceClusterMember
# ===========================================================================


class ReferenceClusterMember(models.Model):
    """
    Membership of a Reference in a ReferenceCluster.

    Each reference appears in at most one *active* (unresolved) cluster per
    review.  Historical memberships from resolved clusters are kept for audit.

    ``completeness_score`` is cached at detection time from
    ``calculate_completeness()`` so the UI can sort potential canonical
    candidates without recomputing it.

    ``best_similarity_score`` is the highest pairwise similarity this
    reference achieved within the cluster (0.0 for DOI-only matches where
    no fuzzy score was computed).
    """

    class Role(models.TextChoices):
        CANONICAL = "canonical", "Canonical (kept)"
        DUPLICATE = "duplicate", "Duplicate (removed)"
        PENDING = "pending", "Pending"

    cluster = models.ForeignKey(
        ReferenceCluster,
        on_delete=models.CASCADE,
        related_name="members",
    )
    reference = models.ForeignKey(
        "references.Reference",
        on_delete=models.CASCADE,
        related_name="cluster_memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.PENDING,
    )
    best_similarity_score = models.FloatField(default=0.0)
    doi_matched = models.BooleanField(default=False)
    # Cached completeness score (see calculate_completeness).
    completeness_score = models.FloatField(default=0.0)

    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "references"
        constraints = [
            models.UniqueConstraint(
                fields=["cluster", "reference"],
                name="unique_reference_per_cluster",
            ),
        ]
        indexes = [
            models.Index(fields=["reference", "role"]),
        ]

    def __str__(self) -> str:
        return f"Member {self.reference_id} in {self.cluster_id} [{self.role}]"


# ===========================================================================
# Union-Find
# ===========================================================================


class UnionFind:
    """
    Weighted quick-union with path compression.

    Used by ``DuplicateClusterDetector`` to merge DOI-matched and fuzzy-matched
    reference pairs into disjoint groups (clusters).

    Nodes are integer Reference PKs; they are lazily initialised on first
    access, so no pre-allocation step is needed.
    """

    def __init__(self):
        self.parent: dict[int, int] = {}
        self.rank: dict[int, int] = {}

    def find(self, x: int) -> int:
        """Find the root of the component containing *x* (with path compression)."""
        if x not in self.parent:
            # Lazily initialise: every node is its own root initially.
            self.parent[x] = x
            self.rank[x] = 0
        if self.parent[x] != x:
            # Path compression: flatten the tree by pointing directly to the root.
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x: int, y: int) -> None:
        """Merge the components containing *x* and *y* (union by rank)."""
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return  # already in the same component
        # Attach the shorter tree under the taller one to keep the tree flat.
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1

    def clusters(self) -> dict[int, list[int]]:
        """
        Return ``{root: [member_ids]}`` for every component with ≥ 2 members.

        Single-node components are excluded because a reference that matches
        nothing is not a duplicate.
        """
        groups: dict[int, list[int]] = {}
        for node in self.parent:
            root = self.find(node)
            groups.setdefault(root, []).append(node)
        return {root: members for root, members in groups.items() if len(members) >= 2}


# ===========================================================================
# DuplicateClusterDetector
# ===========================================================================


class DuplicateClusterDetector:
    """
    Finds duplicate clusters for a queryset of References using two signals:

    1. **DOI hard-match** — references sharing the same non-empty, lowercased,
       trimmed DOI are considered definite duplicates (score = 1.0).

    2. **pg_trgm fuzzy similarity** — a weighted similarity score is computed
       across title, abstract, authors, and journal.  Empty fields are
       excluded from both numerator and denominator so that two references
       with identical non-empty fields score 1.0 regardless of which optional
       fields are blank.

    Both signals feed a Union-Find structure to produce disjoint clusters.
    """

    DEFAULT_WEIGHTS = {
        "title": 0.50,
        "abstract": 0.30,
        "authors": 0.15,
        "journal": 0.05,
    }

    def __init__(
        self,
        queryset,
        fuzzy_threshold: float = 0.50,
        weights: dict | None = None,
    ):
        self.queryset = queryset
        self.fuzzy_threshold = fuzzy_threshold
        self.weights = weights or self.DEFAULT_WEIGHTS

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def detect(self) -> list[dict]:
        """
        Run detection and return a list of cluster dicts::

            {
                "reference_ids": [int, ...],
                "doi_match":     bool,          # True when ALL pairs are DOI-matched
                "pairs":         [(id1, id2, score), ...],
            }
        """
        ids = list(self.queryset.values_list("id", flat=True))
        if len(ids) < 2:
            return []

        uf = UnionFind()
        # Maps (min_id, max_id) → best similarity score seen for that pair.
        edge_scores: dict[tuple[int, int], float] = {}
        doi_edges: set[tuple[int, int]] = set()

        # 1. DOI hard matches (score = 1.0).
        for id1, id2 in self._find_doi_pairs(ids):
            uf.union(id1, id2)
            key = (min(id1, id2), max(id1, id2))
            edge_scores[key] = 1.0
            doi_edges.add(key)

        # 2. Fuzzy matches — keep the best score if a pair also had a DOI match.
        for id1, id2, score in self._find_fuzzy_pairs(ids):
            uf.union(id1, id2)
            key = (min(id1, id2), max(id1, id2))
            edge_scores[key] = max(edge_scores.get(key, 0.0), score)

        # 3. Build structured cluster records from the Union-Find components.
        result = []
        for root, members in uf.clusters().items():
            member_set = set(members)
            cluster_pairs = [
                (k[0], k[1], v)
                for k, v in edge_scores.items()
                if k[0] in member_set and k[1] in member_set
            ]
            # A cluster is DOI-only when every pair was matched via DOI.
            is_doi = bool(cluster_pairs) and all(
                (min(p[0], p[1]), max(p[0], p[1])) in doi_edges for p in cluster_pairs
            )
            result.append(
                {
                    "reference_ids": members,
                    "doi_match": is_doi,
                    "pairs": cluster_pairs,
                }
            )
        return result

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _find_doi_pairs(self, ids: list[int]) -> list[tuple[int, int]]:
        """
        Return all (id1, id2) pairs that share the same non-empty DOI.

        Normalises to ``lower(trim(doi))`` in SQL so that capitalisation and
        surrounding whitespace differences don't prevent matching.
        """
        table = Reference._meta.db_table
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT a.id, b.id
                FROM {table} a
                JOIN {table} b ON a.id < b.id
                WHERE a.id = ANY(%(ids)s)
                  AND b.id = ANY(%(ids)s)
                  AND a.doi <> ''
                  AND b.doi <> ''
                  AND lower(trim(a.doi)) = lower(trim(b.doi))
                """,
                {"ids": ids},
            )
            rows = cursor.fetchall()
        return [(int(r[0]), int(r[1])) for r in rows]

    def _find_fuzzy_pairs(self, ids: list[int]) -> list[tuple[int, int, float]]:
        """
        Return ``(id1, id2, weighted_score)`` for all pairs above the fuzzy
        threshold.

        Scoring
        -------
        Weighted average of pg_trgm similarities across title, abstract,
        authors, and journal.  A field that is empty on *either* reference
        is excluded from both the numerator and the denominator — this prevents
        missing optional fields from pulling the score down for references that
        are otherwise identical.

        ``title`` is always included (non-nullable in the model); all other
        fields use a ``CASE WHEN ... = '' THEN 0 ELSE weight END`` guard.
        """
        table = Reference._meta.db_table
        w = self.weights

        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    a.id AS id1,
                    b.id AS id2,
                    (
                        similarity(a.title, b.title) * %(w_title)s
                        + similarity(a.abstract, b.abstract)
                            * CASE WHEN a.abstract = '' OR b.abstract = ''
                                   THEN 0 ELSE %(w_abstract)s END
                        + similarity(a.authors, b.authors)
                            * CASE WHEN a.authors  = '' OR b.authors  = ''
                                   THEN 0 ELSE %(w_authors)s END
                        + similarity(a.journal, b.journal)
                            * CASE WHEN a.journal  = '' OR b.journal  = ''
                                   THEN 0 ELSE %(w_journal)s END
                    )
                    /
                    NULLIF(
                        %(w_title)s
                        + CASE WHEN a.abstract = '' OR b.abstract = ''
                               THEN 0 ELSE %(w_abstract)s END
                        + CASE WHEN a.authors  = '' OR b.authors  = ''
                               THEN 0 ELSE %(w_authors)s END
                        + CASE WHEN a.journal  = '' OR b.journal  = ''
                               THEN 0 ELSE %(w_journal)s END,
                        0
                    ) AS sim
                FROM {table} a
                JOIN {table} b ON a.id < b.id
                WHERE a.id = ANY(%(ids)s)
                  AND b.id = ANY(%(ids)s)
                  AND (
                        similarity(a.title, b.title) * %(w_title)s
                        + similarity(a.abstract, b.abstract)
                            * CASE WHEN a.abstract = '' OR b.abstract = ''
                                   THEN 0 ELSE %(w_abstract)s END
                        + similarity(a.authors, b.authors)
                            * CASE WHEN a.authors  = '' OR b.authors  = ''
                                   THEN 0 ELSE %(w_authors)s END
                        + similarity(a.journal, b.journal)
                            * CASE WHEN a.journal  = '' OR b.journal  = ''
                                   THEN 0 ELSE %(w_journal)s END
                  )
                  /
                  NULLIF(
                    %(w_title)s
                    + CASE WHEN a.abstract = '' OR b.abstract = '' THEN 0 ELSE %(w_abstract)s END
                    + CASE WHEN a.authors  = '' OR b.authors  = '' THEN 0 ELSE %(w_authors)s END
                    + CASE WHEN a.journal  = '' OR b.journal  = '' THEN 0 ELSE %(w_journal)s END,
                    0
                  ) > %(threshold)s
                ORDER BY sim DESC
                """,
                {
                    "ids": ids,
                    "threshold": self.fuzzy_threshold,
                    "w_title": w["title"],
                    "w_abstract": w["abstract"],
                    "w_authors": w["authors"],
                    "w_journal": w["journal"],
                },
            )
            rows = cursor.fetchall()
        return [(int(r[0]), int(r[1]), float(r[2])) for r in rows]


# ===========================================================================
# Completeness scorer
# ===========================================================================


def calculate_completeness(reference) -> float:
    """
    Compute a normalised completeness score (0.0 – 1.0) for a reference.

    Higher scores mean the record has more bibliographic fields populated
    and/or longer content.  The score is used when selecting the canonical
    reference from a duplicate cluster — the most complete record is kept.

    Field weights
    -------------
    title            0 – 2.0   (proportional to length, capped)
    abstract         0 – 2.0   (proportional to length, capped)
    authors          0 – 1.5   (proportional to length, capped)
    journal          1.0       (boolean: present or absent)
    doi              1.5       (boolean)
    publication_date 1.0       (boolean)
    pages            0.5       (boolean)
    file (PDF)       1.0       (boolean)
    max_score        10.5
    """
    score = 0.0
    max_score = 10.5

    if reference.title:
        score += min(2.0, len(reference.title) / 50)
    if reference.abstract:
        score += min(2.0, len(reference.abstract) / 200)
    if reference.authors:
        score += min(1.5, len(reference.authors) / 50)
    if reference.journal:
        score += 1.0
    if reference.doi:
        score += 1.5
    if reference.publication_date:
        score += 1.0
    if reference.pages:
        score += 0.5
    if getattr(reference, "has_pdf", False):
        score += 1.0

    return score / max_score if max_score > 0 else 0.0


# ===========================================================================
# DuplicateClusterManager
# ===========================================================================


class DuplicateClusterManager:
    """
    Orchestrates cluster detection, persistence, and resolution for a review.

    Usage::

        manager = DuplicateClusterManager(review)
        stats = manager.run()                  # detect + persist
        stats = manager.auto_resolve(...)      # resolve high-confidence clusters
        manager.manually_resolve(cluster, 42)  # resolve a single cluster by hand
    """

    def __init__(
        self,
        review,
        fuzzy_threshold: float = 0.50,
        weights: dict | None = None,
    ):
        self.review = review
        self.fuzzy_threshold = fuzzy_threshold
        self.weights = weights

    # ------------------------------------------------------------------
    # Detection + persistence
    # ------------------------------------------------------------------

    @transaction.atomic
    def run(self, queryset=None) -> dict:
        """
        Detect duplicate clusters and persist any new ones.

        Clusters are only created when they contain at least one reference
        that is not already in an active (unresolved) cluster — this prevents
        re-creating clusters on repeated detection runs.

        Returns a stats dict::

            {
                "raw_clusters_found": int,
                "clusters_created":   int,
                "clusters_skipped":   int,
            }
        """
        if queryset is None:
            queryset = Reference.objects.filter(review=self.review)

        detector = DuplicateClusterDetector(
            queryset,
            fuzzy_threshold=self.fuzzy_threshold,
            weights=self.weights,
        )
        raw_clusters = detector.detect()

        # Pre-load references for completeness scoring (one DB query).
        ref_ids_all = {rid for c in raw_clusters for rid in c["reference_ids"]}
        refs_by_id = {r.id: r for r in Reference.objects.filter(id__in=ref_ids_all)}

        # Which references are already in an active cluster?
        already_clustered = set(
            ReferenceClusterMember.objects.filter(
                cluster__review=self.review,
                cluster__status=ReferenceCluster.Status.UNRESOLVED,
                reference_id__in=ref_ids_all,
            ).values_list("reference_id", flat=True)
        )

        created_clusters = 0
        skipped = 0

        for raw in raw_clusters:
            member_ids = raw["reference_ids"]
            new_ids = set(member_ids) - already_clustered

            # Skip if every member is already in an active cluster.
            if not new_ids and not self._cluster_changed(raw, already_clustered):
                skipped += 1
                continue

            cluster = ReferenceCluster.objects.create(
                review=self.review,
                doi_match=raw["doi_match"],
                max_similarity_score=max((p[2] for p in raw["pairs"]), default=0.0),
            )

            # Cache per-member best similarity and DOI status for sorting.
            best_scores: dict[int, float] = {}
            doi_members: set[int] = set()
            for id1, id2, score in raw["pairs"]:
                best_scores[id1] = max(best_scores.get(id1, 0.0), score)
                best_scores[id2] = max(best_scores.get(id2, 0.0), score)
            if raw["doi_match"]:
                doi_members.update(member_ids)

            ReferenceClusterMember.objects.bulk_create(
                [
                    ReferenceClusterMember(
                        cluster=cluster,
                        reference_id=rid,
                        best_similarity_score=best_scores.get(rid, 0.0),
                        doi_matched=rid in doi_members,
                        completeness_score=calculate_completeness(refs_by_id[rid])
                        if rid in refs_by_id
                        else 0.0,
                    )
                    for rid in member_ids
                ]
            )

            Reference.objects.filter(id__in=member_ids).update(
                duplicate_status=Reference.DuplicateStatus.UNRESOLVED
            )
            created_clusters += 1

        return {
            "raw_clusters_found": len(raw_clusters),
            "clusters_created": created_clusters,
            "clusters_skipped": skipped,
        }

    def _cluster_changed(self, raw: dict, already_clustered: set) -> bool:
        """Return True when at least one member has not yet been clustered."""
        return any(rid not in already_clustered for rid in raw["reference_ids"])

    # ------------------------------------------------------------------
    # Auto-resolution
    # ------------------------------------------------------------------

    @transaction.atomic
    def auto_resolve(
        self,
        confidence_threshold: float = 0.90,
        doi_clusters_always: bool = True,
        preferred_search_method_id: int | None = None,
        resolved_by=None,
    ) -> dict:
        """
        Auto-resolve clusters where confidence is high enough.

        A cluster is resolved when:
        - ``doi_clusters_always=True`` and ``cluster.doi_match`` is True, **or**
        - ``cluster.max_similarity_score >= confidence_threshold``.

        The canonical reference is chosen by ``_pick_canonical``.

        Returns::

            {
                "auto_resolved":      int,  # clusters resolved
                "kept_references":    int,  # canonical references
                "removed_references": int,  # duplicates marked DELETED
            }
        """
        clusters = ReferenceCluster.objects.filter(
            review=self.review,
            status=ReferenceCluster.Status.UNRESOLVED,
        ).prefetch_related("members__reference")

        auto_resolved = kept = removed = 0

        for cluster in clusters:
            should_resolve = (
                doi_clusters_always and cluster.doi_match
            ) or cluster.max_similarity_score >= confidence_threshold

            if not should_resolve:
                continue

            members = list(cluster.members.select_related("reference"))
            if len(members) < 2:
                continue

            canonical_member = self._pick_canonical(members, preferred_search_method_id)
            canonical_ref = canonical_member.reference

            ref_updates_canonical = []
            ref_updates_duplicate = []
            for m in members:
                if m.id == canonical_member.id:
                    m.role = ReferenceClusterMember.Role.CANONICAL
                    ref_updates_canonical.append(m.reference_id)
                else:
                    m.role = ReferenceClusterMember.Role.DUPLICATE
                    ref_updates_duplicate.append(m.reference_id)

            ReferenceClusterMember.objects.bulk_update(members, ["role"])

            Reference.objects.filter(id__in=ref_updates_canonical).update(
                duplicate_status=Reference.DuplicateStatus.RESOLVED
            )
            Reference.objects.filter(id__in=ref_updates_duplicate).update(
                duplicate_status=Reference.DuplicateStatus.DELETED
            )

            cluster.status = ReferenceCluster.Status.AUTO_RESOLVED
            cluster.canonical_reference = canonical_ref
            cluster.resolved_at = timezone.now()
            cluster.resolved_by = resolved_by
            cluster.save(
                update_fields=[
                    "status",
                    "canonical_reference",
                    "resolved_at",
                    "resolved_by",
                ]
            )

            auto_resolved += 1
            kept += 1
            removed += len(ref_updates_duplicate)

        return {
            "auto_resolved": auto_resolved,
            "kept_references": kept,
            "removed_references": removed,
        }

    # ------------------------------------------------------------------
    # Manual resolution
    # ------------------------------------------------------------------

    @transaction.atomic
    def manually_resolve(
        self,
        cluster: ReferenceCluster,
        canonical_reference_id: int,
        resolved_by=None,
    ) -> None:
        """
        Resolve a cluster by explicitly nominating the canonical reference.

        All other members are marked DUPLICATE / DELETED.  The cluster status
        is set to MANUALLY_RESOLVED.
        """
        members = list(cluster.members.select_related("reference"))

        canonical_ids = [canonical_reference_id]
        duplicate_ids = [
            m.reference_id for m in members if m.reference_id != canonical_reference_id
        ]

        for m in members:
            m.role = (
                ReferenceClusterMember.Role.CANONICAL
                if m.reference_id == canonical_reference_id
                else ReferenceClusterMember.Role.DUPLICATE
            )
        ReferenceClusterMember.objects.bulk_update(members, ["role"])

        Reference.objects.filter(id__in=canonical_ids).update(
            duplicate_status=Reference.DuplicateStatus.RESOLVED
        )
        Reference.objects.filter(id__in=duplicate_ids).update(
            duplicate_status=Reference.DuplicateStatus.DELETED
        )

        cluster.status = ReferenceCluster.Status.MANUALLY_RESOLVED
        cluster.canonical_reference_id = canonical_reference_id
        cluster.resolved_at = timezone.now()
        cluster.resolved_by = resolved_by
        cluster.save(
            update_fields=[
                "status",
                "canonical_reference_id",
                "resolved_at",
                "resolved_by",
            ]
        )

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _pick_canonical(
        self,
        members: list[ReferenceClusterMember],
        preferred_search_method_id: int | None,
    ) -> ReferenceClusterMember:
        """
        Choose the best member to keep as the canonical reference.

        Priority order
        --------------
        1. DOI-matched members (hard evidence of the "real" record).
        2. Members from the preferred search method (if supplied).
        3. Highest completeness score.
        4. Lowest reference ID as a deterministic tie-break.
        """
        # Prefer DOI-matched members if any exist.
        doi_members = [m for m in members if m.doi_matched]
        if doi_members:
            members = doi_members

        # Prefer the nominated search method if supplied.
        if preferred_search_method_id:
            method_members = [
                m
                for m in members
                if m.reference.search_method_id == preferred_search_method_id
            ]
            if method_members:
                members = method_members

        # Highest completeness wins; lowest ID breaks ties.
        return max(members, key=lambda m: (m.completeness_score, -m.reference_id))


# ===========================================================================
# Top-level convenience functions (used by Celery tasks / management commands)
# ===========================================================================


def detect_and_persist_clusters(
    review,
    queryset=None,
    fuzzy_threshold: float = 0.50,
    weights: dict | None = None,
) -> dict:
    """Detect duplicates and persist new clusters for *review*."""
    manager = DuplicateClusterManager(
        review, fuzzy_threshold=fuzzy_threshold, weights=weights
    )
    return manager.run(queryset=queryset)


def auto_resolve_clusters(
    review,
    confidence_threshold: float = 0.90,
    doi_clusters_always: bool = True,
    preferred_search_method_id: int | None = None,
    resolved_by=None,
) -> dict:
    """Auto-resolve high-confidence clusters for *review*."""
    manager = DuplicateClusterManager(review)
    return manager.auto_resolve(
        confidence_threshold=confidence_threshold,
        doi_clusters_always=doi_clusters_always,
        preferred_search_method_id=preferred_search_method_id,
        resolved_by=resolved_by,
    )


# ===========================================================================
# Reason
# ===========================================================================


class Reason(models.Model):
    """
    A named exclusion reason for a review.

    When a member excludes a reference they may optionally attach a Reason so
    the review owner can understand why references were rejected at the
    full-text stage.  Reasons appear in the PRISMA diagram's
    ``excluded_reasons`` breakdown.
    """

    review = models.ForeignKey("reviews.Review", on_delete=models.CASCADE)
    name = models.CharField(max_length=150)

    def __str__(self) -> str:
        return self.name


# ===========================================================================
# ReferenceOpinion
# ===========================================================================


class ReferenceOpinion(models.Model):
    """
    A single member's verdict on a reference at a specific screening stage.

    The combination of (reference, member, stage) is unique — a member can
    hold exactly one opinion per reference per stage.  Opinions are updated
    in place via ``bulk-upsert``; the history is not preserved.

    After each upsert, ``Reference.update_opinion_statuses()`` recomputes the
    denormalised ``screening_status`` / ``full_text_status`` field on the
    affected references.
    """

    class Stage(models.TextChoices):
        SCREENING = "screening", "Screening"
        FULL_TEXT = "full-text", "Full-Text Screening"

    reference = models.ForeignKey(Reference, on_delete=models.CASCADE)
    member = models.ForeignKey("reviews.ReviewMember", on_delete=models.CASCADE)
    status = models.CharField(
        max_length=20,
        choices=ReferenceOpinionStatus.choices,
        default=ReferenceOpinionStatus.UNDECIDED,
    )
    stage = models.CharField(
        max_length=20,
        choices=Stage.choices,
        default=Stage.SCREENING,
    )
    # Optional exclusion reason — only populated when status == EXCLUDED.
    reason = models.ForeignKey(Reason, null=True, on_delete=models.SET_NULL)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["reference", "member", "stage"],
                name="unique_reference_opinion",
            ),
        ]


# ===========================================================================
# Keyword
# ===========================================================================


class Keyword(models.Model):
    """
    A keyword used for inclusion or exclusion filtering during screening.

    Keywords are stored per-review and matched against the reference
    ``search_vector`` using PostgreSQL full-text search.
    """

    class Type(models.TextChoices):
        INCLUSION = "inclusion"
        EXCLUSION = "exclusion"

    review = models.ForeignKey("reviews.Review", on_delete=models.CASCADE)
    name = models.CharField(max_length=150)
    type = models.CharField(max_length=20, choices=Type.choices)


# ===========================================================================
# Note
# ===========================================================================


class Note(models.Model):
    """
    A free-text note left by a reviewer on a specific reference.

    ``created_at`` is set on creation; ``edited_at`` is updated on every
    subsequent save.  Notes on blinded reviews are only visible to their author.
    """

    member = models.ForeignKey(
        "reviews.ReviewMember",
        on_delete=models.CASCADE,
        related_name="notes",
    )
    reference = models.ForeignKey(
        Reference,
        on_delete=models.CASCADE,
        related_name="notes",
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        """Set ``edited_at`` whenever an existing note is modified."""
        if self.pk:
            self.edited_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Note by {self.member} on {self.created_at.strftime('%d-%m-%Y %H:%M')}"
