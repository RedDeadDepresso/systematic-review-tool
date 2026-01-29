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
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    reference_duplicate_detected = models.BooleanField(default=False)
    collaborators = models.ManyToManyField(User, related_name="collaborators")
    is_blinded = models.BooleanField(default=True)

    def __str__(self):
        return self.title


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
    duplicate_status = models.CharField(
        max_length=20,
        choices=[
            ("Unresolved", "Unresolved"),
            ("Deleted", "Deleted"),
            ("Not Duplicate", "Not Duplicate"),
            ("Resolved", "Resolved"),
            ("Unique", "Unique"),
        ],
        default="Unique",
    )
    search_vector = SearchVectorField(null=True, blank=True)
    assignee = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)

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
    def _find_pairs(cls, queryset, threshold=0.5):
        """Find similar Reference title pairs within queryset."""
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
                    similarity(a.title, b.title) AS sim
                FROM {table} a
                JOIN {table} b
                  ON a.id < b.id
                WHERE a.id = ANY(%s)
                  AND b.id = ANY(%s)
                  AND similarity(a.title, b.title) > %s
                ORDER BY sim DESC
                """,
                [ids, ids, threshold],
            )
            return cursor.fetchall()

    @classmethod
    @transaction.atomic
    def _create_pairs(cls, review, raw_pairs):
        """
        Create DuplicatePair objects from detected pairs.
        Also sets duplicate_status to 'Unresolved' for both references in each pair.
        """
        to_create = []
        reference_ids_to_update = set()

        for r in raw_pairs:
            to_create.append(
                ReferenceDuplicatePair(
                    review=review,
                    reference1_id=r[0],
                    reference2_id=r[1],
                    similarity_score=r[2],
                )
            )
            reference_ids_to_update.update([r[0], r[1]])

        created = len(cls.objects.bulk_create(to_create, ignore_conflicts=True))

        if reference_ids_to_update:
            Reference.objects.filter(id__in=reference_ids_to_update).update(
                duplicate_status="Unresolved"
            )

        return created

    @classmethod
    def create_pairs(cls, review, queryset, threshold=0.5):
        """Find and create DuplicatePair objects from detected pairs. queryset is a Reference queryset."""
        raw_pairs = cls._find_pairs(queryset, threshold)
        created_count = cls._create_pairs(review, raw_pairs)
        return created_count

    def __str__(self):
        return f"DuplicatePair({self.reference1.id}, {self.reference2.id})"


class ReferenceOpinion(models.Model):
    reference = models.ForeignKey(Reference, on_delete=models.CASCADE)
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE)
    status = models.CharField(
        max_length=20,
        choices=[
            ("Undecided", "Undecided"),
            ("Excluded", "Excluded"),
            ("Maybe", "Maybe"),
            ("Included", "Included"),
        ],
        default="Undecided",
    )

    class Meta:
        unique_together = ("reference", "reviewer")


class Keyword(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    name = models.CharField(max_length=150)
    is_inclusive = models.BooleanField()


class Note(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notes")
    reference = models.ForeignKey(
        Reference, on_delete=models.CASCADE, related_name="notes"
    )
    content = models.TextField()
    date_created = models.DateTimeField(auto_now_add=True)
    date_edited = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Note by {self.author.username} on {self.date_created.strftime('%Y-%m-%d %H:%M')}"


class ReviewInvitation(models.Model):
    email = models.EmailField()
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    invited_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="sent_invitations"
    )
    created_at = models.DateTimeField(auto_now_add=True)

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
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    def __str__(self):
        return self.name


class SubTheme(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
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
    # Core identity
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    # Highlight type
    type = models.CharField(
        max_length=20,
        choices=[
            ("text", "Text"),
            ("area", "Area"),
            ("freetext", "Free text"),
            ("image", "Image"),
            ("drawing", "Drawing"),
            ("shape", "Shape"),
        ],
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
    user = models.ForeignKey(User, on_delete=models.CASCADE)
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
        choices=[
            ("highlight", "Highlight"),
            ("underline", "Underline"),
            ("strikethrough", "Strikethrough"),
        ],
        null=True,
        blank=True,
    )

    def __str__(self):
        return self.name
