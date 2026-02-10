import uuid

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.contrib.postgres.indexes import GinIndex, OpClass
from django.contrib.postgres.search import SearchVectorField
from django.db import connection, models, transaction
from django.db.models.functions import Lower
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True, verbose_name="email address")
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"


class Review(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    date_created = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    reference_duplicate_detected = models.BooleanField(default=False)
    is_blinded = models.BooleanField(default=True)
    prisma_file = models.FileField(upload_to="prisma_diagrams/", blank=True, null=True)

    def __str__(self):
        return self.title


class ReviewMember(models.Model):
    class Role(models.TextChoices):
        OWNER = "Owner"
        COLLABORATOR = "Collaborator"
        REVIEWER = "Reviewer"
        VIEWER = "Viewer"

    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reviews")
    role = models.CharField(max_length=20, choices=Role.choices)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["review", "user"],
                name="unique_user_per_review",
            )
        ]

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name} ({self.user.email})"


class SearchMethod(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class Label(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    color = models.CharField(max_length=50, default="#3b82f6")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name"],
                name="unique_label_per_user",
            )
        ]


def reference_upload_path(instance, filename):
    return f"references/{uuid.uuid4()}/{filename}"


class Reference(models.Model):
    class DuplicateStatus(models.TextChoices):
        UNRESOLVED = "Unresolved"
        DELETED = "Deleted"
        NOT_DUPLICATE = "Not Duplicate"
        RESOLVED = "Resolved"
        UNIQUE = "Unique"

    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    title = models.TextField()
    publication_type = models.CharField(max_length=255)
    publication_date = models.DateField(null=True, blank=True)
    authors = models.TextField()
    journal = models.CharField(max_length=255)
    search_method = models.ForeignKey(SearchMethod, on_delete=models.CASCADE)
    article_customizations = models.CharField(max_length=255)
    abstract = models.TextField(blank=True)
    doi = models.CharField(max_length=255, blank=True)
    url = models.URLField(max_length=500, blank=True)
    file = models.FileField(upload_to=reference_upload_path, blank=True, null=True)
    search_vector = SearchVectorField(null=True, blank=True)
    assignee = models.ForeignKey(ReviewMember, null=True, on_delete=models.SET_NULL)
    duplicate_status = models.CharField(
        max_length=20, choices=DuplicateStatus.choices, default=DuplicateStatus.UNIQUE
    )
    in_full_text = models.BooleanField(default=False)
    in_extraction = models.BooleanField(default=False)
    is_extraction_completed = models.BooleanField(default=False)

    class Meta:
        indexes = [
            GinIndex(fields=["search_vector"], name="reference_search_vector_idx"),
            GinIndex(
                OpClass(Lower("title"), "gin_trgm_ops"), name="reference_title_trgm_idx"
            ),
        ]

    def __str__(self):
        return f"{self.review.id} {self.id}"


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
    member = models.ForeignKey(ReviewMember, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["reference", "label"],
                name="unique_label_assignment",
            )
        ]


class UploadedPDF(models.Model):
    file = models.FileField(upload_to=reference_upload_path)
    review = models.ForeignKey(Review, on_delete=models.CASCADE)


class ReferenceDuplicatePair(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    reference1 = models.ForeignKey(
        "Reference", on_delete=models.CASCADE, related_name="duplicate_reference1"
    )
    reference2 = models.ForeignKey(
        "Reference", on_delete=models.CASCADE, related_name="duplicate_reference2"
    )
    similarity_score = models.FloatField()
    resolved = models.BooleanField(default=False)

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

    def __str__(self):
        return f"DuplicatePair({self.reference1.id}, {self.reference2.id})"


class Reason(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    name = models.CharField(max_length=150)

    def __str__(self):
        return self.name


class ReferenceOpinion(models.Model):
    class Status(models.TextChoices):
        UNDECIDED = "Undecided"
        EXCLUDED = "Excluded"
        MAYBE = "Maybe"
        INCLUDED = "Included"

    class Stage(models.TextChoices):
        SCREENING = "screening", "Screening"
        FULL_TEXT = "full-text", "Full-Text Screening"

    reference = models.ForeignKey(Reference, on_delete=models.CASCADE)
    member = models.ForeignKey(ReviewMember, on_delete=models.CASCADE)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UNDECIDED,
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
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    name = models.CharField(max_length=150)
    is_inclusive = models.BooleanField()


class Note(models.Model):
    member = models.ForeignKey(
        ReviewMember, on_delete=models.CASCADE, related_name="notes"
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


class ReviewInvitation(models.Model):
    class Role(models.TextChoices):
        COLLABORATOR = "Collaborator"
        REVIEWER = "Reviewer"
        VIEWER = "Viewer"

    email = models.EmailField()
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    invited_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="sent_invitations"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    role = models.CharField(max_length=20, choices=Role.choices)

    def __str__(self):
        return f"Invitation to {self.email} for review {self.review.id}"


class Notification(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="notifications"
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notification for {self.user.email} at {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class MainTheme(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    member = models.ForeignKey(ReviewMember, on_delete=models.CASCADE)

    def __str__(self):
        return self.name


class SubTheme(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    member = models.ForeignKey(ReviewMember, on_delete=models.CASCADE)
    main_theme = models.ForeignKey(
        MainTheme,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sub_themes",
    )

    def __str__(self):
        return self.name


class Code(models.Model):
    class HighlightType(models.TextChoices):
        TEXT = "text", "Text"
        AREA = "area", "Area"
        FREETEXT = "freetext", "Free text"
        IMAGE = "image", "Image"
        DRAWING = "drawing", "Drawing"
        SHAPE = "shape", "Shape"

    class HighlightStyle(models.TextChoices):
        HIGHLIGHT = "highlight", "Highlight"
        UNDERLINE = "underline", "Underline"
        STRIKETHROUGH = "strikethrough", "Strikethrough"

    # Core identity
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    # Highlight type
    type = models.CharField(
        max_length=20,
        choices=HighlightType.choices,
        null=True,
        blank=True,
    )

    name = models.TextField(blank=False)
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    reference = models.ForeignKey(
        Reference,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="codes",
    )
    member = models.ForeignKey(ReviewMember, on_delete=models.CASCADE)
    sub_theme = models.ForeignKey(
        SubTheme, on_delete=models.SET_NULL, null=True, blank=True, related_name="codes"
    )

    # react-pdf-highlighter payloads
    content = models.JSONField(null=True, blank=True)
    position = models.JSONField(null=True, blank=True)

    # Comment
    comment = models.TextField(null=True, blank=True)

    # Text / Area highlight styles
    highlight_color = models.CharField(max_length=50, null=True, blank=True)
    highlight_style = models.CharField(
        max_length=20,
        choices=HighlightStyle.choices,
        null=True,
        blank=True,
    )

    def __str__(self):
        return self.name


class ScreeningCriteria(models.Model):
    class Kind(models.TextChoices):
        INCLUSIVE = "Inclusive"
        EXCLUSIVE = "Exclusive"

    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    kind = models.CharField(max_length=20, choices=Kind.choices)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["review", "name"],
                name="unique_criteria_per_review",
            )
        ]


class ExtractionSection(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["review", "name"], name="unique_review_section_name"
            )
        ]

    def __str__(self):
        return f"{self.review} - {self.name}"


class ExtractionQuestion(models.Model):
    class QuestionType(models.TextChoices):
        FREE_TEXT = "free-text", "Free Text"
        NUMBER = "number", "Number"
        DATE = "date", "Date"
        SINGLE_SELECT = "single-select", "Single Select"
        MULTI_SELECT = "multi-select", "Multi Select"
        BOOLEAN = "boolean", "Boolean"

    section = models.ForeignKey(
        ExtractionSection, on_delete=models.CASCADE, related_name="questions"
    )
    question = models.TextField()
    column_title = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=QuestionType.choices)
    options = models.JSONField(null=True, blank=True)
    required = models.BooleanField(default=False)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.section.name} - {self.column_title}"


class ExtractionAnswer(models.Model):
    reference = models.ForeignKey(
        Reference, on_delete=models.CASCADE, related_name="extraction_answers"
    )
    question = models.ForeignKey(
        ExtractionQuestion, on_delete=models.CASCADE, related_name="answers"
    )
    value = models.TextField(blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["reference", "question"],
                name="unique_reference_question_answer",
            )
        ]

    def __str__(self):
        return f"Answer for {self.question.column_title} - Ref {self.reference.id}"


class ScreeningStat(models.Model):
    member = models.ForeignKey(ReviewMember, on_delete=models.CASCADE)
    seconds = models.IntegerField(default=0)
    sessions = models.IntegerField(default=0)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["member"], name="unique_screening_stat_per_member"
            )
        ]

    def __str__(self):
        return f"{self.member} - {self.seconds}s ({self.sessions} sessions)"
