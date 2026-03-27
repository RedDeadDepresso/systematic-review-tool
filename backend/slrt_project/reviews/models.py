import os
import uuid

from django.db import models
from django.db.models import Count, F, Q, Value
from django.db.models.functions import Concat


# Review


class Review(models.Model):
    """
    Represents a systematic literature review (SLR).
    """

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

    # Soft-delete flag: inactive reviews are hidden but not removed.
    is_active = models.BooleanField(default=True)

    # When blinded, a reviewer can only see their own opinions (not teammates').
    is_blinded = models.BooleanField(default=True)

    # Optional PRISMA flow diagram uploaded by the review owner.
    prisma_file = models.FileField(upload_to="prisma_diagrams/", blank=True, null=True)

    def __str__(self) -> str:
        return self.title

    # Opinion statistics

    def compute_opinion_stats(self, stage, user=None) -> list[dict]:
        """
        Return per-member opinion counts (excluded / maybe / included / total)
        for the given screening *stage*.
        """
        # Import here to avoid circular imports between the reviews and
        # references apps.
        from slrt_project.references.models import (
            ReferenceOpinion,
            ReferenceOpinionStatus,
        )

        qs = ReferenceOpinion.objects.filter(
            member__review=self, stage=stage
        ).select_related("member__user")

        # Blind mode: restrict to the requesting user's own opinions.
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


# ReviewMember


class ReviewMember(models.Model):
    """
    Associates a user with a review and assigns them a role.
    """

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

    def __str__(self) -> str:
        return f"{self.user.first_name} {self.user.last_name} ({self.user.email})"

    @property
    def user_name(self) -> str:
        """Full name of the member, falling back to their e-mail address."""
        return (
            f"{self.user.first_name} {self.user.last_name}".strip() or self.user.email
        )


# ReviewInvitation


class ReviewInvitation(models.Model):
    """
    Pending invitation for an e-mail address to join a review.
    """

    # Invited role is a subset of ReviewMember.Role — owners cannot be invited.
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

    def __str__(self) -> str:
        return f"Invitation to {self.email} for review {self.review_id}"


# ScreeningCriteria


class ScreeningCriteria(models.Model):
    """
    Inclusion or exclusion criterion used during the screening stage.
    """

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

    def __str__(self) -> str:
        return f"[{self.type}] {self.name}"


# ScreeningStat


class ScreeningStat(models.Model):
    """
    Aggregated screening activity for a single review member.
    """

    # One stat row per member.
    member = models.OneToOneField(
        ReviewMember,
        on_delete=models.CASCADE,
        # Keep OneToOneField semantics; the UniqueConstraint below is
        # kept for an explicit DB-level guarantee.
    )
    seconds = models.IntegerField(default=0)
    sessions = models.IntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["member"],
                name="unique_screening_stat_per_member",
            )
        ]

    def __str__(self) -> str:
        return f"{self.member} — {self.seconds}s ({self.sessions} sessions)"


# ReviewChatMessage


class ReviewChatMessage(models.Model):
    """
    A single message in a review's chat channel.
    """

    review = models.ForeignKey(
        Review, on_delete=models.CASCADE, related_name="chat_messages"
    )
    # Null for system messages.
    member = models.ForeignKey(
        ReviewMember,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Review member who sent the message. Null for system messages.",
    )
    message = models.TextField()
    is_system_message = models.BooleanField(
        default=False,
        help_text="True if this is a system notification.",
    )
    # Free-form JSON payload for system messages (e.g., task results).
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["review", "created_at"]),
            models.Index(fields=["review", "is_system_message"]),
        ]

    def __str__(self) -> str:
        prefix = self.user_name
        return f"{prefix}: {self.message[:50]}"

    @property
    def user_name(self) -> str:
        """Display name of the sender (or 'System' / 'Unknown' as fallbacks)."""
        if self.is_system_message:
            return "System"
        if self.member:
            user = self.member.user
            return f"{user.first_name} {user.last_name}".strip() or user.email
        return "Unknown"


# SearchMethod


def search_method_upload_path(instance: "SearchMethod", filename: str) -> str:
    """
    Generate a unique storage path for each uploaded search-method file.
    """
    ext = filename.rsplit(".", 1)[-1]
    return os.path.join("search_methods", f"{uuid.uuid4()}.{ext}")


class SearchMethod(models.Model):
    """
    A named literature search run associated with a review.
    """

    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    file = models.FileField(
        upload_to=search_method_upload_path,
        null=True,
        blank=True,
        help_text="Uploaded BibTeX file (deleted after successful import).",
    )

    def __str__(self) -> str:
        return self.name
