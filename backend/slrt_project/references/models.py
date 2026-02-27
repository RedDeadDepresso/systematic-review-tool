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


class ReferenceDuplicatePair(models.Model):
    review = models.ForeignKey("reviews.Review", on_delete=models.CASCADE)
    reference1 = models.ForeignKey(
        "Reference", on_delete=models.CASCADE, related_name="duplicate_reference1"
    )
    reference2 = models.ForeignKey(
        "Reference", on_delete=models.CASCADE, related_name="duplicate_reference2"
    )
    similarity_score = models.FloatField()
    resolved = models.BooleanField(default=False)
    auto_resolved = models.BooleanField(
        default=False, help_text="True if resolved automatically by the system"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["review", "reference1", "reference2"],
                name="unique_duplicatepair_per_review_refs",
            ),
        ]

    @classmethod
    def _find_pairs(cls, queryset, threshold=0.5, weights=None):
        """Find similar Reference pairs using multiple fields."""
        if weights is None:
            weights = {"title": 0.5, "abstract": 0.3, "authors": 0.15, "journal": 0.05}

        table = Reference._meta.db_table
        ids = list(queryset.values_list("id", flat=True))
        if not ids:
            return []

        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    a.id AS id1,
                    b.id AS id2,
                    (
                        similarity(a.title, b.title) * %(title_weight)s +
                        similarity(a.abstract, b.abstract) * %(abstract_weight)s +
                        similarity(a.authors, b.authors) * %(authors_weight)s +
                        similarity(a.journal, b.journal) * %(journal_weight)s
                    ) AS sim
                FROM {table} a
                JOIN {table} b ON a.id < b.id
                WHERE a.id = ANY(%(ids)s)
                AND b.id = ANY(%(ids)s)
                AND (
                    similarity(a.title, b.title) * %(title_weight)s +
                    similarity(a.abstract, b.abstract) * %(abstract_weight)s +
                    similarity(a.authors, b.authors) * %(authors_weight)s +
                    similarity(a.journal, b.journal) * %(journal_weight)s
                ) > %(threshold)s
                ORDER BY sim DESC
                """,
                {
                    "ids": ids,
                    "threshold": threshold,
                    "title_weight": weights["title"],
                    "abstract_weight": weights["abstract"],
                    "authors_weight": weights["authors"],
                    "journal_weight": weights["journal"],
                },
            )
            return cursor.fetchall()

    @classmethod
    @transaction.atomic
    def _create_pairs(cls, review, raw_pairs):
        """
        Create DuplicatePair objects from detected pairs.
        Skip pairs that already exist (resolved or not).
        Only sets duplicate_status to 'Unresolved' for new pairs.
        """
        # Get existing pairs to avoid recreating them
        existing_pairs = set(
            cls.objects.filter(review=review).values_list(
                "reference1_id", "reference2_id"
            )
        )

        to_create = []
        new_reference_ids = set()

        for r in raw_pairs:
            pair_key = (r[0], r[1])
            # Skip if this pair already exists
            if pair_key not in existing_pairs:
                to_create.append(
                    ReferenceDuplicatePair(
                        review=review,
                        reference1_id=r[0],
                        reference2_id=r[1],
                        similarity_score=r[2],
                    )
                )
                new_reference_ids.update([r[0], r[1]])

        created = len(cls.objects.bulk_create(to_create, ignore_conflicts=True))

        # Only update references that are part of NEW pairs AND currently marked as 'Unique'
        if new_reference_ids:
            Reference.objects.filter(
                id__in=new_reference_ids, duplicate_status="Unique"
            ).update(duplicate_status="Unresolved")

        return created

    @classmethod
    def create_pairs(cls, review, queryset, threshold=0.5):
        """Find and create DuplicatePair objects from detected pairs. queryset is a Reference queryset."""
        raw_pairs = cls._find_pairs(queryset, threshold)
        created_count = cls._create_pairs(review, raw_pairs)
        return created_count

    @classmethod
    def auto_resolve_duplicates(
        cls,
        review,
        confidence_threshold=0.90,
        criteria=None,
        text_normalization=False,
        preferred_search_method_id=None,
    ):
        """
        Auto-resolve duplicate pairs with high similarity and matching criteria
        Uses PostgreSQL for text normalization
        """
        criteria = criteria or {}

        # Get unresolved pairs with high confidence
        high_confidence_pairs = cls.objects.filter(
            review=review, resolved=False, similarity_score__gte=confidence_threshold
        ).select_related(
            "reference1",
            "reference2",
            "reference1__search_method",
            "reference2__search_method",
        )

        auto_resolved_count = 0
        kept_references_count = 0
        removed_references_count = 0

        for pair in high_confidence_pairs:
            ref1 = pair.reference1
            ref2 = pair.reference2

            # Check additional criteria using PostgreSQL if text normalization is enabled
            if text_normalization and any(
                [
                    criteria.get("authors"),
                    criteria.get("title"),
                    criteria.get("journal"),
                    criteria.get("doi"),
                    criteria.get("pages"),
                ]
            ):
                # Build SQL query to check criteria using PostgreSQL normalization
                criteria_match = cls._check_normalized_criteria(ref1, ref2, criteria)
            else:
                # Check criteria without normalization
                criteria_match = cls._check_criteria(ref1, ref2, criteria)

            if not criteria_match:
                continue

            # Determine which reference to keep
            kept = None
            removed = None

            # Priority 1: Preferred search method
            if preferred_search_method_id:
                if (
                    ref1.search_method_id == preferred_search_method_id
                    and ref2.search_method_id != preferred_search_method_id
                ):
                    kept = ref1
                    removed = ref2
                elif (
                    ref2.search_method_id == preferred_search_method_id
                    and ref1.search_method_id != preferred_search_method_id
                ):
                    kept = ref2
                    removed = ref1

            # Priority 2: Completeness score (if search method didn't determine)
            if not kept:
                ref1_score = cls._calculate_completeness(ref1)
                ref2_score = cls._calculate_completeness(ref2)

                if ref1_score >= ref2_score:
                    kept = ref1
                    removed = ref2
                else:
                    kept = ref2
                    removed = ref1

            # Mark the removed one as duplicate
            removed.duplicate_status = Reference.DuplicateStatus.DELETED
            removed.save()

            # Mark the kept one as unique
            kept.duplicate_status = Reference.DuplicateStatus.RESOLVED
            kept.save()

            # Mark pair as auto-resolved
            pair.resolved = True
            pair.auto_resolved = True
            pair.save()

            auto_resolved_count += 1
            kept_references_count += 1
            removed_references_count += 1

        return {
            "auto_resolved": auto_resolved_count,
            "kept_references": kept_references_count,
            "removed_references": removed_references_count,
        }

    @classmethod
    def _check_normalized_criteria(cls, ref1, ref2, criteria):
        """
        Check criteria using PostgreSQL's normalize_text function
        """
        with connection.cursor() as cursor:
            conditions = []
            params = []

            if criteria.get("authors"):
                conditions.append("normalize_text(%s) = normalize_text(%s)")
                params.extend([ref1.authors or "", ref2.authors or ""])

            if criteria.get("title"):
                conditions.append("normalize_text(%s) = normalize_text(%s)")
                params.extend([ref1.title or "", ref2.title or ""])

            if criteria.get("journal"):
                conditions.append("normalize_text(%s) = normalize_text(%s)")
                params.extend([ref1.journal or "", ref2.journal or ""])

            if criteria.get("doi"):
                conditions.append("normalize_text(%s) = normalize_text(%s)")
                params.extend([ref1.doi or "", ref2.doi or ""])

            if criteria.get("pages"):
                conditions.append("normalize_text(%s) = normalize_text(%s)")
                params.extend([ref1.pages or "", ref2.pages or ""])

            if criteria.get("year"):
                year1 = ref1.publication_date.year if ref1.publication_date else None
                year2 = ref2.publication_date.year if ref2.publication_date else None
                if year1 != year2:
                    return False

            # If no text conditions, return True
            if not conditions:
                return True

            # Check all conditions in single query
            sql = f"SELECT {' AND '.join(conditions)}"
            cursor.execute(sql, params)
            result = cursor.fetchone()

            return result[0] if result else False

    @classmethod
    def _check_criteria(cls, ref1, ref2, criteria):
        """
        Check criteria without normalization (exact match)
        """
        if criteria.get("authors"):
            if (ref1.authors or "") != (ref2.authors or ""):
                return False

        if criteria.get("title"):
            if (ref1.title or "") != (ref2.title or ""):
                return False

        if criteria.get("journal"):
            if (ref1.journal or "") != (ref2.journal or ""):
                return False

        if criteria.get("year"):
            year1 = ref1.publication_date.year if ref1.publication_date else None
            year2 = ref2.publication_date.year if ref2.publication_date else None
            if year1 != year2:
                return False

        if criteria.get("doi"):
            if (ref1.doi or "") != (ref2.doi or ""):
                return False

        if criteria.get("pages"):
            if (ref1.pages or "") != (ref2.pages or ""):
                return False

        return True

    @staticmethod
    def _calculate_completeness(reference):
        """
        Calculate how complete a reference is (0.0 to 1.0)
        Higher score = more complete
        """
        score = 0.0
        max_score = 0.0

        # Title (required, but check length)
        max_score += 2.0
        if reference.title:
            score += min(2.0, len(reference.title) / 50)  # Full points if >50 chars

        # Abstract
        max_score += 2.0
        if reference.abstract:
            score += min(2.0, len(reference.abstract) / 200)

        # Authors
        max_score += 1.5
        if reference.authors:
            score += min(1.5, len(reference.authors) / 50)

        # Journal
        max_score += 1.0
        if reference.journal:
            score += 1.0

        # DOI (important!)
        max_score += 1.5
        if reference.doi:
            score += 1.5

        # Publication date
        max_score += 1.0
        if reference.publication_date:
            score += 1.0

        # Pages
        max_score += 0.5
        if reference.pages:
            score += 0.5

        # PDF file
        max_score += 1.0
        if reference.has_pdf:
            score += 1.0

        return (score / max_score) if max_score > 0 else 0.0

    def __str__(self):
        return f"DuplicatePair({self.reference1.id}, {self.reference2.id})"


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
