import uuid

from cryptography.fernet import Fernet
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.contrib.postgres.indexes import GinIndex, OpClass
from django.contrib.postgres.search import SearchVectorField
from django.core.validators import FileExtensionValidator
from django.db import connection, models, transaction
from django.db.models.functions import Lower
from django.utils import timezone

from backend import settings


class UserManager(BaseUserManager):
    def create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True, verbose_name="email address")
    avatar = models.ImageField(
        upload_to="avatars/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "gif"])],
        help_text="Upload a profile picture",
    )
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

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

    @property
    def user_name(self):
        """Get display name for the member"""
        return (
            f"{self.user.first_name} {self.user.last_name}".strip() or self.user.email
        )


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

    zotero_key = models.CharField(max_length=100, blank=True, null=True)
    zotero_version = models.IntegerField(default=0)
    last_synced = models.DateTimeField(null=True, blank=True)

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

    @property
    def has_pdf(self):
        """Check if reference has a PDF file"""
        return bool(self.file)

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
    def auto_resolve_duplicates(cls, review, confidence_threshold=0.9):
        """
        Auto-resolve duplicate pairs with very high similarity scores
        Similar to Rayyan's auto-resolver

        Args:
            review: Review instance
            confidence_threshold: Similarity threshold for auto-resolution (0.0-1.0)

        Returns:
            dict with counts of auto-resolved pairs
        """
        # Get unresolved pairs with high confidence
        high_confidence_pairs = cls.objects.filter(
            review=review, resolved=False, similarity_score__gte=confidence_threshold
        ).select_related("reference1", "reference2")

        auto_resolved_count = 0
        kept_references = []
        removed_references = []

        for pair in high_confidence_pairs:
            # Auto-resolution logic: keep the one with more complete data
            ref1 = pair.reference1
            ref2 = pair.reference2

            # Calculate completeness score
            ref1_score = cls._calculate_completeness(ref1)
            ref2_score = cls._calculate_completeness(ref2)

            if ref1_score >= ref2_score:
                kept = ref1
                removed = ref2
            else:
                kept = ref2
                removed = ref1

            # Mark the less complete one as duplicate
            removed.duplicate_status = "Duplicate"
            removed.save()

            # Mark the better one as unique
            kept.duplicate_status = "Unique"
            kept.save()

            # Mark pair as auto-resolved
            pair.resolved = True
            pair.auto_resolved = True
            pair.save()

            auto_resolved_count += 1
            kept_references.append(kept.id)
            removed_references.append(removed.id)

        return {
            "auto_resolved": auto_resolved_count,
            "kept_references": kept_references,
            "removed_references": removed_references,
        }

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

        # PDF file
        max_score += 1.0
        if reference.has_pdf:
            score += 1.0

        return (score / max_score) if max_score > 0 else 0.0

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

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["member"], name="unique_screening_stat_per_member"
            )
        ]

    def __str__(self):
        return f"{self.member} - {self.seconds}s ({self.sessions} sessions)"


class ZoteroIntegration(models.Model):
    """Zotero integration settings for a review"""

    review = models.OneToOneField(
        Review, on_delete=models.CASCADE, related_name="zotero_integration"
    )

    # Library credentials
    library_id = models.CharField(
        max_length=100, help_text="Zotero User ID or Group ID"
    )
    _api_key = models.CharField(
        max_length=500, db_column="api_key", help_text="Encrypted Zotero API key"
    )
    library_type = models.CharField(
        max_length=10,
        choices=[("user", "Personal Library"), ("group", "Group Library")],
        default="user",
    )

    # Collection filter (optional)
    collection_key = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Optional: Only sync items from this collection",
    )
    collection_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Display name of the selected collection",
    )

    # Sync metadata
    last_push_at = models.DateTimeField(null=True, blank=True)
    last_pull_at = models.DateTimeField(null=True, blank=True)
    last_sync_version = models.IntegerField(
        default=0, help_text="Last library version synced"
    )

    # Status
    is_active = models.BooleanField(
        default=True, help_text="Enable/disable Zotero sync for this review"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Zotero Integration"
        verbose_name_plural = "Zotero Integrations"

    def __str__(self):
        return f"Zotero Integration for {self.review.title}"

    @property
    def api_key(self):
        """Decrypt and return API key"""
        if not self._api_key:
            return None

        # If encryption is enabled
        if settings.ENCRYPTION_KEY:
            try:
                cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())
                return cipher_suite.decrypt(self._api_key.encode()).decode()
            except Exception:
                # If decryption fails, return as-is (backwards compatibility)
                return self._api_key

        return self._api_key

    @api_key.setter
    def api_key(self, value):
        """Encrypt and store API key"""
        if value is None:
            self._api_key = None
            return

        # If encryption is enabled
        if settings.ENCRYPTION_KEY:
            cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())
            self._api_key = cipher_suite.encrypt(value.encode()).decode()
        else:
            self._api_key = value

    @property
    def is_configured(self):
        """Check if Zotero is properly configured"""
        return bool(self.library_id and self._api_key and self.is_active)

    def get_credentials(self):
        """Get Zotero credentials tuple"""
        if self.is_configured:
            return (self.library_id, self.api_key, self.library_type)
        return (None, None, None)


class ZoteroSyncLog(models.Model):
    """Track Zotero sync operations"""

    review = models.ForeignKey(Review, on_delete=models.CASCADE)

    sync_type = models.CharField(
        max_length=20,
        choices=[
            ("push", "Push to Zotero"),
            ("pull", "Pull from Zotero"),
        ],
    )

    items_processed = models.IntegerField(default=0)
    items_with_pdfs = models.IntegerField(default=0)

    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)

    library_version = models.IntegerField(
        null=True, blank=True, help_text="Zotero library version at time of sync"
    )

    synced_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-synced_at"]
        verbose_name = "Zotero Sync Log"
        verbose_name_plural = "Zotero Sync Logs"

    def __str__(self):
        return f"{self.review.title} - {self.sync_type} - {self.synced_at}"


class ReviewChatMessage(models.Model):
    """
    Chat messages between review members and system notifications
    """

    review = models.ForeignKey(
        Review, on_delete=models.CASCADE, related_name="chat_messages"
    )
    member = models.ForeignKey(
        ReviewMember,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Review member who sent the message. Null for system messages.",
    )
    message = models.TextField()

    # Flag for system messages
    is_system_message = models.BooleanField(
        default=False, help_text="True if this is a system notification"
    )

    # Optional: store additional data as JSON
    metadata = models.JSONField(
        null=True,
        blank=True,
        help_text="Additional data for system messages (e.g., task results)",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["review", "created_at"]),
            models.Index(fields=["review", "is_system_message"]),
        ]

    def __str__(self):
        if self.is_system_message:
            return f"System: {self.message[:50]}"
        if self.member:
            return f"{self.member.user.email}: {self.message[:50]}"
        return f"Unknown: {self.message[:50]}"

    @property
    def user_name(self):
        """Get display name for the message sender"""
        if self.is_system_message:
            return "System"
        if self.member:
            user = self.member.user
            return f"{user.first_name} {user.last_name}".strip() or user.email
        return "Unknown"
