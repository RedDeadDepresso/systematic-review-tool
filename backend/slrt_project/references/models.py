import uuid

from django.contrib.postgres.indexes import GinIndex, OpClass
from django.contrib.postgres.search import SearchVectorField
from django.db import connection, models, transaction
from django.db.models import Case, CharField, Count, Func, Max, Value, When
from django.db.models.functions import Lower
from django.utils import timezone


# Create your models here.
class Label(models.Model):
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


def reference_upload_path(instance, filename):
    return f"references/{uuid.uuid4()}/{filename}"


class ReferenceOpinionStatus(models.TextChoices):
    UNDECIDED = "Undecided"
    EXCLUDED = "Excluded"
    MAYBE = "Maybe"
    INCLUDED = "Included"


class Reference(models.Model):
    class DuplicateStatus(models.TextChoices):
        UNRESOLVED = "Unresolved"
        DELETED = "Deleted"
        NOT_DUPLICATE = "Not Duplicate"
        RESOLVED = "Resolved"
        UNIQUE = "Unique"

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
    file = models.FileField(
        upload_to=reference_upload_path, blank=True, null=True, max_length=255
    )
    search_vector = SearchVectorField(null=True, blank=True)
    assignee = models.ForeignKey(
        "reviews.ReviewMember", null=True, on_delete=models.SET_NULL
    )
    duplicate_status = models.CharField(
        max_length=20, choices=DuplicateStatus.choices, default=DuplicateStatus.UNIQUE
    )
    in_full_text = models.BooleanField(default=False)
    in_extraction = models.BooleanField(default=False)
    is_extraction_completed = models.BooleanField(default=False)

    zotero_key = models.CharField(max_length=100, blank=True, null=True)
    zotero_version = models.IntegerField(default=0)
    last_synced = models.DateTimeField(null=True, blank=True)
    pages = models.CharField(max_length=50, blank=True, default="")
    screening_status = models.CharField(
        max_length=20,
        blank=True,
        default=ReferenceOpinionStatus.UNDECIDED,
    )
    full_text_status = models.CharField(
        max_length=20,
        blank=True,
        default=ReferenceOpinionStatus.UNDECIDED,
    )

    class Meta:
        indexes = [
            GinIndex(fields=["search_vector"], name="reference_search_vector_idx"),
            GinIndex(
                OpClass(Lower("title"), "gin_trgm_ops"), name="reference_title_trgm_idx"
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["review", "zotero_key"],
                name="unique_zotero_key_per_review",
                condition=models.Q(zotero_key__isnull=False),
            )
        ]

    @classmethod
    def update_opinion_statuses(cls, reference_ids=None, stage=None):
        if stage not in [
            ReferenceOpinion.Stage.SCREENING,
            ReferenceOpinion.Stage.FULL_TEXT,
        ]:
            raise ValueError("Invalid stage")

        refs_qs = cls.objects.all()
        if reference_ids:
            refs_qs = refs_qs.filter(id__in=reference_ids)

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

        status_map = {}

        for op in opinions:
            if op["distinct_count"] == 0:
                effective_status = ReferenceOpinionStatus.UNDECIDED

            elif op["distinct_count"] == 1:
                # All same → use that status (Included, Excluded, Maybe)
                effective_status = op["max_status"]

            else:
                # Conflicting opinions → now UNDECIDED (not Maybe anymore)
                effective_status = ReferenceOpinionStatus.UNDECIDED

            status_map[op["reference_id"]] = effective_status

        # References without opinions
        all_ids = set(refs_qs.values_list("id", flat=True))
        for ref_id in all_ids:
            if ref_id not in status_map:
                status_map[ref_id] = ReferenceOpinionStatus.UNDECIDED

        when_statements = [
            When(id=ref_id, then=Value(status)) for ref_id, status in status_map.items()
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

    @property
    def has_pdf(self):
        """Check if reference has a PDF file"""
        return bool(self.file)

    def __str__(self):
        return f"{self.review.id} {self.id} {self.title}"


class ReferenceLabel(models.Model):
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
    member = models.ForeignKey("reviews.ReviewMember", on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["reference", "label"],
                name="unique_label_assignment",
            )
        ]


class ImmutableUnaccent(Func):
    function = "immutable_unaccent"
    arity = 1


class UploadedPDF(models.Model):
    review = models.ForeignKey(
        "reviews.Review",
        on_delete=models.CASCADE,
        related_name="uploaded_pdfs",
    )

    file = models.FileField(upload_to="uploaded_pdfs/", max_length=255)
    name = models.TextField()
    doi = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["doi"]),
            # GIN trgm index created via RunSQL in migration due to expression limitations
        ]

    def __str__(self):
        return f"{self.name}.pdf"


class ReferenceCluster(models.Model):
    """
    One cluster of duplicate (or near-duplicate) References.

    Every Reference belongs to at most one unresolved cluster.
    After resolution the cluster is archived with a canonical reference recorded.
    """

    class Status(models.TextChoices):
        UNRESOLVED = "unresolved", "Unresolved"
        AUTO_RESOLVED = "auto_resolved", "Auto-Resolved"
        MANUALLY_RESOLVED = "manually_resolved", "Manually Resolved"
        DISMISSED = "dismissed", "Dismissed"

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
    # Set when resolved – the reference we decided to keep
    canonical_reference = models.ForeignKey(
        "references.Reference",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="canonical_in_clusters",
    )
    # Highest pairwise similarity score in the cluster (for UI sorting)
    max_similarity_score = models.FloatField(default=0.0)
    # True when every member had a matching DOI (perfect hard match cluster)
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
        return self.members.count()


class ReferenceClusterMember(models.Model):
    """
    Membership of a Reference in a ReferenceCluster.

    Each reference appears in at most one *active* (unresolved) cluster per review.
    Historical memberships (from resolved clusters) are kept for audit.
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
    # Best pairwise similarity this reference achieved within the cluster
    best_similarity_score = models.FloatField(default=0.0)
    # Whether this member was matched via DOI (hard match)
    doi_matched = models.BooleanField(default=False)
    # Completeness score at time of cluster creation (cached for sorting)
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


# ---------------------------------------------------------------------------
# Union-Find helper
# ---------------------------------------------------------------------------


class UnionFind:
    """Weighted quick-union with path compression."""

    def __init__(self):
        self.parent: dict[int, int] = {}
        self.rank: dict[int, int] = {}

    def find(self, x: int) -> int:
        if x not in self.parent:
            self.parent[x] = x
            self.rank[x] = 0
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x: int, y: int) -> None:
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1

    def clusters(self) -> dict[int, list[int]]:
        """Return {root: [member_ids]} for clusters with ≥2 members."""
        groups: dict[int, list[int]] = {}
        for node in self.parent:
            root = self.find(node)
            groups.setdefault(root, []).append(node)
        return {root: members for root, members in groups.items() if len(members) >= 2}


# ---------------------------------------------------------------------------
# Cluster detector
# ---------------------------------------------------------------------------


class DuplicateClusterDetector:
    """
    Finds duplicate clusters for a queryset of References.

    Strategy
    --------
    1. DOI hard-match: group references that share the same non-empty DOI.
    2. Fuzzy pg_trgm similarity: weighted score across title/abstract/authors/journal.
    3. Union-Find merges both signals into clusters.
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
        # local import to avoid circularity

        self.queryset = queryset
        self.fuzzy_threshold = fuzzy_threshold
        self.weights = weights or self.DEFAULT_WEIGHTS
        self.Reference = Reference

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def detect(self) -> list[dict]:
        """
        Returns a list of cluster dicts:
          {
            "reference_ids": [int, ...],
            "doi_match": bool,
            "pairs": [(id1, id2, score), ...],
          }
        """
        ids = list(self.queryset.values_list("id", flat=True))
        if len(ids) < 2:
            return []

        uf = UnionFind()
        edge_scores: dict[tuple[int, int], float] = {}
        doi_edges: set[tuple[int, int]] = set()

        # 1. DOI hard matches
        doi_pairs = self._find_doi_pairs(ids)
        for id1, id2 in doi_pairs:
            uf.union(id1, id2)
            key = (min(id1, id2), max(id1, id2))
            edge_scores[key] = 1.0
            doi_edges.add(key)

        # 2. Fuzzy matches
        fuzzy_pairs = self._find_fuzzy_pairs(ids)
        for id1, id2, score in fuzzy_pairs:
            uf.union(id1, id2)
            key = (min(id1, id2), max(id1, id2))
            # Keep best score if the pair appeared via both signals
            edge_scores[key] = max(edge_scores.get(key, 0.0), score)

        # 3. Build cluster records
        clusters_raw = uf.clusters()
        result = []
        for root, members in clusters_raw.items():
            member_set = set(members)
            cluster_pairs = [
                (k[0], k[1], v)
                for k, v in edge_scores.items()
                if k[0] in member_set and k[1] in member_set
            ]
            is_doi = all(
                (min(id1, id2), max(id1, id2)) in doi_edges
                for id1, id2 in [(p[0], p[1]) for p in cluster_pairs]
            ) and bool(cluster_pairs)
            result.append(
                {
                    "reference_ids": members,
                    "doi_match": is_doi,
                    "pairs": cluster_pairs,
                }
            )
        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _find_doi_pairs(self, ids: list[int]) -> list[tuple[int, int]]:
        """
        Find pairs of references that share the same non-empty, non-null DOI.
        Normalises DOI to lowercase and strips whitespace in Python (fast enough
        for DOI matching; avoids needing a custom SQL function).
        """
        table = self.Reference._meta.db_table
        pairs: list[tuple[int, int]] = []

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
            pairs = cursor.fetchall()

        return [(int(r[0]), int(r[1])) for r in pairs]

    def _find_fuzzy_pairs(self, ids: list[int]) -> list[tuple[int, int, float]]:
        """
        Find pairs above the fuzzy threshold using pg_trgm similarity.
        Returns [(id1, id2, weighted_score), ...] where id1 < id2.
        """
        table = self.Reference._meta.db_table
        w = self.weights

        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    a.id AS id1,
                    b.id AS id2,
                    (
                        similarity(a.title,    b.title)    * %(w_title)s +
                        similarity(a.abstract, b.abstract) * %(w_abstract)s +
                        similarity(a.authors,  b.authors)  * %(w_authors)s +
                        similarity(a.journal,  b.journal)  * %(w_journal)s
                    ) AS sim
                FROM {table} a
                JOIN {table} b ON a.id < b.id
                WHERE a.id = ANY(%(ids)s)
                  AND b.id = ANY(%(ids)s)
                  AND (
                    similarity(a.title,    b.title)    * %(w_title)s +
                    similarity(a.abstract, b.abstract) * %(w_abstract)s +
                    similarity(a.authors,  b.authors)  * %(w_authors)s +
                    similarity(a.journal,  b.journal)  * %(w_journal)s
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


# ---------------------------------------------------------------------------
# Completeness scorer (same logic as before, now standalone)
# ---------------------------------------------------------------------------


def calculate_completeness(reference) -> float:
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


# ---------------------------------------------------------------------------
# Cluster manager
# ---------------------------------------------------------------------------


class DuplicateClusterManager:
    """
    Orchestrates cluster detection, persistence, and auto-resolution.

    Usage
    -----
        manager = DuplicateClusterManager(review)
        stats = manager.run(queryset=review.reference_set.filter(...))
    """

    def __init__(
        self, review, fuzzy_threshold: float = 0.50, weights: dict | None = None
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
        Detect clusters and persist new ones.
        Returns stats dict.
        """
        # local import

        if queryset is None:
            queryset = Reference.objects.filter(review=self.review)

        detector = DuplicateClusterDetector(
            queryset,
            fuzzy_threshold=self.fuzzy_threshold,
            weights=self.weights,
        )
        raw_clusters = detector.detect()

        # Load references for completeness scoring
        ref_ids_all = {rid for c in raw_clusters for rid in c["reference_ids"]}
        refs_by_id = {r.id: r for r in Reference.objects.filter(id__in=ref_ids_all)}

        # Find which references are already in an unresolved cluster for this review
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

            # All members already in active clusters → nothing to do
            if not new_ids and not self._cluster_changed(raw, already_clustered):
                skipped += 1
                continue

            # Check if any of the new_ids' existing clusters should be merged
            # For simplicity: create a new cluster for truly new groups.
            # A production system might merge existing clusters here.
            cluster = ReferenceCluster.objects.create(
                review=self.review,
                doi_match=raw["doi_match"],
                max_similarity_score=max((p[2] for p in raw["pairs"]), default=0.0),
            )

            # Build pair lookup for best_similarity_score per member
            best_scores: dict[int, float] = {}
            doi_members: set[int] = set()

            for id1, id2, score in raw["pairs"]:
                best_scores[id1] = max(best_scores.get(id1, 0.0), score)
                best_scores[id2] = max(best_scores.get(id2, 0.0), score)

            if raw["doi_match"]:
                doi_members.update(member_ids)

            members_to_create = []
            for rid in member_ids:
                ref = refs_by_id.get(rid)
                members_to_create.append(
                    ReferenceClusterMember(
                        cluster=cluster,
                        reference_id=rid,
                        best_similarity_score=best_scores.get(rid, 0.0),
                        doi_matched=rid in doi_members,
                        completeness_score=calculate_completeness(ref) if ref else 0.0,
                    )
                )
            ReferenceClusterMember.objects.bulk_create(members_to_create)
            created_clusters += 1

        return {
            "raw_clusters_found": len(raw_clusters),
            "clusters_created": created_clusters,
            "clusters_skipped": skipped,
        }

    def _cluster_changed(self, raw: dict, already_clustered: set) -> bool:
        """Heuristic: if any member is NOT yet clustered, the cluster is new/changed."""
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

        doi_clusters_always=True → resolve DOI clusters regardless of score.
        """

        clusters = ReferenceCluster.objects.filter(
            review=self.review,
            status=ReferenceCluster.Status.UNRESOLVED,
        ).prefetch_related("members__reference")

        auto_resolved = 0
        kept = 0
        removed = 0

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

            # Update roles + reference statuses
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

            # Update canonical reference
            Reference.objects.filter(id__in=ref_updates_canonical).update(
                duplicate_status=Reference.DuplicateStatus.RESOLVED
            )
            # Mark duplicates as deleted
            Reference.objects.filter(id__in=ref_updates_duplicate).update(
                duplicate_status=Reference.DuplicateStatus.DELETED
            )

            # Resolve the cluster
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

    @transaction.atomic
    def manually_resolve(
        self,
        cluster: ReferenceCluster,
        canonical_reference_id: int,
        resolved_by=None,
    ) -> None:
        """
        Manually resolve a cluster by choosing a canonical reference.
        """

        members = list(cluster.members.select_related("reference"))

        canonical_ids = [canonical_reference_id]
        duplicate_ids = [
            m.reference_id for m in members if m.reference_id != canonical_reference_id
        ]

        for m in members:
            if m.reference_id == canonical_reference_id:
                m.role = ReferenceClusterMember.Role.CANONICAL
            else:
                m.role = ReferenceClusterMember.Role.DUPLICATE
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
        Pick the best member to keep.

        Priority:
          1. DOI-matched member (hard evidence it's the "real" record)
          2. Preferred search method
          3. Highest completeness score
          4. Tie-break: lowest id (deterministic)
        """
        # 1. DOI match preferred
        doi_members = [m for m in members if m.doi_matched]
        if doi_members:
            members = doi_members

        # 2. Preferred search method
        if preferred_search_method_id:
            method_members = [
                m
                for m in members
                if m.reference.search_method_id == preferred_search_method_id
            ]
            if method_members:
                members = method_members

        # 3. Best completeness, then lowest id
        return max(members, key=lambda m: (m.completeness_score, -m.reference_id))


# ---------------------------------------------------------------------------
# Convenience: top-level run function (for tasks / management commands)
# ---------------------------------------------------------------------------


def detect_and_persist_clusters(
    review,
    queryset=None,
    fuzzy_threshold: float = 0.50,
    weights: dict | None = None,
) -> dict:
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
    manager = DuplicateClusterManager(review)
    return manager.auto_resolve(
        confidence_threshold=confidence_threshold,
        doi_clusters_always=doi_clusters_always,
        preferred_search_method_id=preferred_search_method_id,
        resolved_by=resolved_by,
    )


class Reason(models.Model):
    review = models.ForeignKey("reviews.Review", on_delete=models.CASCADE)
    name = models.CharField(max_length=150)

    def __str__(self):
        return self.name


class ReferenceOpinion(models.Model):
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


class Keyword(models.Model):
    review = models.ForeignKey("reviews.Review", on_delete=models.CASCADE)
    name = models.CharField(max_length=150)
    is_inclusive = models.BooleanField()


class Note(models.Model):
    member = models.ForeignKey(
        "reviews.ReviewMember", on_delete=models.CASCADE, related_name="notes"
    )
    reference = models.ForeignKey(
        Reference, on_delete=models.CASCADE, related_name="notes"
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if self.pk:
            self.edited_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Note by {self.member} on {self.created_at.strftime('%d-%m-%Y %H:%M')}"
