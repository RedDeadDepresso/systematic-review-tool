import os
import uuid

from django.db import models


# Create your models here.


class Review(models.Model):
    class DuplicateDetectionStatus(models.TextChoices):
        NOT_STARTED = "Not Started"
        PENDING = "Pending"
        COMPLETED = "Completed"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    date_created = models.DateTimeField(auto_now_add=True)
    duplicate_detection_status = models.CharField(
        max_length=20,
        choices=DuplicateDetectionStatus.choices,
        default=DuplicateDetectionStatus.NOT_STARTED,
    )
    is_active = models.BooleanField(default=True)
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
    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="reviews"
    )
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


class ReviewInvitation(models.Model):
    class Role(models.TextChoices):
        COLLABORATOR = "Collaborator"
        REVIEWER = "Reviewer"
        VIEWER = "Viewer"

    email = models.EmailField()
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    invited_by = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="sent_invitations"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    role = models.CharField(max_length=20, choices=Role.choices)

    def __str__(self):
        return f"Invitation to {self.email} for review {self.review.id}"


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


def search_method_upload_path(instance, filename):
    ext = filename.split(".")[-1]
    new_filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join("search_methods", new_filename)


class SearchMethod(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    file = models.FileField(
        upload_to=search_method_upload_path,
        null=True,
        blank=True,
        help_text="Uploaded BibTeX file (deleted after successful import)",
    )

    def __str__(self):
        return self.name
