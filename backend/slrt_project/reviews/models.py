import os
import uuid

from django.db import models
from django.db.models import Count, F, Q, Value
from django.db.models.functions import Concat


# Create your models here.


class Review(models.Model):
    class DuplicateDetectionStatus(models.TextChoices):
        NOT_STARTED = "not_started", "Not Started"
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"

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

    def compute_opinion_stats(self, stage, user=None):
        from slrt_project.references.models import (
            ReferenceOpinion,
            ReferenceOpinionStatus,
        )

        qs = ReferenceOpinion.objects.filter(
            member__review=self,
            stage=stage,
        ).select_related("member__user")

        if self.is_blinded and user:
            qs = qs.filter(member__user=user)

        stats = (
            qs.values(
                "member_id",
                user_name=Concat(
                    F("member__user__first_name"),
                    Value(" "),
                    F("member__user__last_name"),
                ),
                user_email=F("member__user__email"),
            )
            .annotate(
                excluded=Count("id", filter=Q(status=ReferenceOpinionStatus.EXCLUDED)),
                maybe=Count("id", filter=Q(status=ReferenceOpinionStatus.MAYBE)),
                included=Count("id", filter=Q(status=ReferenceOpinionStatus.INCLUDED)),
                total=Count("id"),
            )
            .order_by("-total")
        )

        return list(stats)

    def __str__(self):
        return self.title


class ReviewMember(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        COLLABORATOR = "collaborator", "Collaborator"
        REVIEWER = "reviewer", "Reviewer"
        VIEWER = "viewer", "Viewer"

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
        COLLABORATOR = "collaborator", "Collaborator"
        REVIEWER = "reviewer", "Reviewer"
        VIEWER = "viewer", "Viewer"

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
    class Type(models.TextChoices):
        INCLUSION = "inclusion"
        EXCLUSION = "exclusion"

    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=20, choices=Type.choices)

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
