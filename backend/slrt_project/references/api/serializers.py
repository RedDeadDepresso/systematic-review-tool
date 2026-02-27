import os

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from slrt_project.permissions import PERMISSIONS, Permission, permission_denied_message
from slrt_project.references.models import (
    Keyword,
    Label,
    Note,
    Reason,
    Reference,
    ReferenceDuplicatePair,
    ReferenceLabel,
    ReferenceOpinion,
    ReferenceOpinionStatus,
    UploadedPDF,
)
from slrt_project.reviews.api.serializers import ReviewMemberSerializer
from slrt_project.reviews.models import Review, ReviewMember


class UploadedPDFSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    def get_name(self, obj):
        return os.path.basename(obj.file.name)

    class Meta:
        model = UploadedPDF
        fields = ["id", "name", "file", "review"]
        read_only_fields = ["id"]

    def validate_file(self, value):
        if not value.name.lower().endswith(".pdf"):
            raise serializers.ValidationError("Only PDF files are allowed.")
        return value


class AttachPDFMappingSerializer(serializers.Serializer):
    reference_id = serializers.IntegerField()
    uploaded_pdf_id = serializers.IntegerField()


class AttachPDFsSerializer(serializers.Serializer):
    mappings = AttachPDFMappingSerializer(many=True)


class AutoMatchSerializer(serializers.Serializer):
    review_id = serializers.IntegerField()
    reference_ids = serializers.ListField(child=serializers.IntegerField())


class BaseReferenceSerializer(serializers.ModelSerializer):
    search_method = serializers.StringRelatedField()

    class Meta:
        model = Reference
        fields = [
            "id",
            "title",
            "publication_type",
            "authors",
            "journal",
            "search_method",
            "article_customizations",
            "abstract",
            "doi",
            "publication_date",
            "duplicate_status",
            "pages",
        ]
        read_only_fields = fields


class ReferenceSerializer(BaseReferenceSerializer):
    opinions = serializers.SerializerMethodField()
    publication_date = serializers.DateField(format="%d/%m/%Y")
    labels = serializers.SerializerMethodField()
    assignee = serializers.SerializerMethodField()

    class Meta:
        model = Reference
        fields = BaseReferenceSerializer.Meta.fields + [
            "opinions",
            "labels",
            "assignee",
        ]
        read_only_fields = fields

    def get_opinions(self, obj):
        opinions = getattr(obj, "prefetched_opinions", None)
        if opinions is None:
            return None
        return [
            {
                "member": {
                    "id": op.member.id,
                    "user": {
                        "first_name": op.member.user.first_name,
                        "last_name": op.member.user.last_name,
                        "email": op.member.user.email,
                        "display_name": str(op.member.user),
                    },
                },
                "status": op.status,
                "reason": op.reason.name if op.reason else None,
                "updated_at": op.updated_at.strftime("%H:%M %d/%m/%Y"),
            }
            for op in opinions
        ]

    def get_labels(self, obj):
        """
        Return labels applied to this reference for the current user only.
        Expects that `obj` has a `prefetched_labels` prefetched attribute.
        """
        user = self.context["request"].user
        # Fallback if prefetch not done
        reference_labels = getattr(obj, "prefetched_labels", None)
        if reference_labels is None:
            reference_labels = ReferenceLabel.objects.filter(
                reference=obj, label__user=user
            ).select_related("label")

        return [
            {"id": rl.label.id, "name": rl.label.name, "color": rl.label.color}
            for rl in reference_labels
        ]

    def get_assignee(self, obj):
        if not obj.assignee:
            return None
        return {
            "id": obj.assignee.id,
            "user": {
                "first_name": obj.assignee.user.first_name,
                "last_name": obj.assignee.user.last_name,
                "email": obj.assignee.user.email,
            },
        }


class ReferenceOpinionSerializer(serializers.ModelSerializer):
    member = serializers.StringRelatedField()
    reason = serializers.StringRelatedField(read_only=True)
    updated_at = serializers.DateTimeField(format="%h:%m %d/%m/%Y")

    class Meta:
        model = ReferenceOpinion
        fields = ["id", "member", "status", "reason", "updated_at"]
        read_only_fields = ["id", "member", "reason", "updated_at"]

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        status = attrs.get("status", getattr(instance, "status", None))
        reason = attrs.get("reason", getattr(instance, "reason", None))
        reference = attrs.get("reference", getattr(instance, "reference", None))

        # Only keep reason when excluded
        if status != ReferenceOpinionStatus.EXCLUDED:
            attrs["reason"] = None

        # If reason exists, ensure same review
        if reason and reference:
            if reason.review_id != reference.review_id:
                raise serializers.ValidationError(
                    {"reason": "Reason must belong to the same review."}
                )

        return attrs


class ReferenceDuplicatePairSerializer(serializers.ModelSerializer):
    reference1 = BaseReferenceSerializer(read_only=True)
    reference2 = BaseReferenceSerializer(read_only=True)

    class Meta:
        model = ReferenceDuplicatePair
        fields = ["id", "reference1", "reference2", "similarity_score"]


class KeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = Keyword
        fields = ["id", "review", "name", "is_inclusive"]
        read_only_fields = ["id", "review"]


class NoteSerializer(serializers.ModelSerializer):
    member = ReviewMemberSerializer(read_only=True)

    class Meta:
        model = Note
        fields = ["id", "member", "content", "created_at", "edited_at"]
        read_only_fields = ["member", "created_at", "edited_at"]


class BulkCreateNoteSerializer(serializers.Serializer):
    reference_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )
    content = serializers.CharField()


class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ["id", "user", "name", "color", "hotkey"]
        read_only_fields = ["id", "user"]

    def validate_name(self, value):
        """
        Ensure the user doesn't already have a label with this name.
        """
        user = self.context["request"].user
        if Label.objects.filter(user=user, name=value).exists():
            raise serializers.ValidationError(
                "You already have a label with this name."
            )
        return value


class AssignReferencesSerializer(serializers.Serializer):
    review = serializers.IntegerField()
    reference_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )
    mode = serializers.ChoiceField(choices=["assign", "remove", "split_equally"])
    assignee_id = serializers.IntegerField(required=False)


class AssignLabelsSerializer(serializers.Serializer):
    review = serializers.PrimaryKeyRelatedField(queryset=Review.objects.all())
    reference_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
    )
    checked_label_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
    )
    indeterminate_label_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
    )

    def validate(self, data):
        user = self.context["request"].user
        review = data["review"]

        # Membership check
        try:
            member = ReviewMember.objects.get(review=review, user=user)
        except ReviewMember.DoesNotExist:
            raise serializers.ValidationError(
                {"review": "You are not a member of this review."}
            )

        permission = Permission.ASSIGN_LABEL
        if member.role not in PERMISSIONS[permission]:
            raise PermissionDenied(permission_denied_message(permission))

        # Normalize IDs
        reference_ids = set(data["reference_ids"])
        checked_ids = set(data["checked_label_ids"])
        indeterminate_ids = set(data["indeterminate_label_ids"])

        # Validate references belong to review
        references = Reference.objects.filter(
            review=review,
            id__in=reference_ids,
        )
        if references.count() != len(reference_ids):
            raise serializers.ValidationError(
                {
                    "reference_ids": "One or more references do not belong to this review."
                }
            )

        # Validate labels belong to user
        label_ids = checked_ids | indeterminate_ids
        labels = Label.objects.filter(user=user, id__in=label_ids)
        if labels.count() != len(label_ids):
            raise serializers.ValidationError(
                {"label_ids": "One or more labels do not belong to you."}
            )

        data["member"] = member
        data["references"] = references
        data["labels"] = {label.id: label for label in labels}
        data["checked_ids"] = checked_ids
        data["indeterminate_ids"] = indeterminate_ids

        return data


class ReferenceOpinionUpsertSerializer(serializers.Serializer):
    reference_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        help_text="List of reference IDs to upsert opinions for",
    )
    status = serializers.ChoiceField(
        choices=ReferenceOpinionStatus.choices,
        help_text="Status to set for the opinions",
    )
    stage = serializers.ChoiceField(
        choices=ReferenceOpinion.Stage.choices,
        help_text="Stage for which opinions are upserted",
    )
    reason = serializers.PrimaryKeyRelatedField(
        queryset=Reason.objects.all(),
        required=False,
        allow_null=True,
    )

    def validate_reference_ids(self, value):
        if len(set(value)) != len(value):
            value = list(set(value))
        return value

    def validate(self, attrs):
        if attrs["status"] != ReferenceOpinionStatus.EXCLUDED:
            attrs["reason"] = None
        return attrs


class ReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reason
        fields = ["id", "name", "review"]
        read_only_fields = ["id"]
