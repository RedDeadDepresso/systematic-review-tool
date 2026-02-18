import os
from datetime import date

from django.db import models
from django.db.models import Count, F, Q, Value
from django.db.models.functions import Concat
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.serializers import ModelSerializer

from api.models import (
    Code,
    ExtractionAnswer,
    ExtractionQuestion,
    ExtractionSection,
    Keyword,
    Label,
    MainTheme,
    Note,
    Reason,
    Reference,
    ReferenceDuplicatePair,
    ReferenceLabel,
    ReferenceOpinion,
    Review,
    ReviewChatMessage,
    ReviewInvitation,
    ReviewMember,
    ScreeningCriteria,
    ScreeningStat,
    SubTheme,
    UploadedPDF,
    User,
    ZoteroIntegration,
    ZoteroSyncLog,
)
from api.permissions import PERMISSIONS, Permission, permission_denied_message


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "avatar", "display_name"]
        read_only_fields = ["id"]

    def get_display_name(self, obj):
        return str(obj)

    def update(self, instance, validated_data):
        from allauth.account.models import EmailAddress

        if self.initial_data.get("avatar") == "":
            instance.avatar = None

        previous_email = instance.email

        updated_instance = super().update(instance, validated_data)

        if previous_email != updated_instance.email:
            EmailAddress.objects.filter(
                user=updated_instance, email=previous_email
            ).delete()
            EmailAddress.objects.get_or_create(
                user=updated_instance, email=updated_instance.email
            )

        return updated_instance


class ReviewMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ReviewMember
        fields = ["id", "role", "user"]
        read_only_fields = ["id", "user"]

    def validate_role(self, new_role):
        """
        Enforce role rules:
        - Owner role cannot be changed
        - No one can be promoted to Owner
        """
        instance = self.instance  # existing ReviewMember

        if not instance:
            return new_role

        current_role = instance.role

        #  Cannot modify an existing Owner
        if current_role == ReviewMember.Role.OWNER:
            raise serializers.ValidationError(
                "You cannot change the role of the review owner."
            )

        # Cannot promote someone to Owner
        if new_role == ReviewMember.Role.OWNER:
            raise serializers.ValidationError("You cannot assign the Owner role.")

        return new_role


class ReviewChatMessageSerializer(serializers.ModelSerializer):
    member = ReviewMemberSerializer()

    class Meta:
        model = ReviewChatMessage
        fields = "__all__"


class ScreeningStatSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()
    hours = serializers.SerializerMethodField()

    def get_user_name(self, obj):
        return f"{obj.member.user.first_name} {obj.member.user.last_name}".strip()

    def get_user_email(self, obj):
        return obj.member.user.email

    def get_hours(self, obj):
        return round(obj.seconds / 3600, 2)

    class Meta:
        model = ScreeningStat
        fields = ["id", "user_name", "user_email", "seconds", "hours", "sessions"]


class OpinionStatsSerializer(serializers.Serializer):
    """Serializer for aggregated opinion statistics per member"""

    member_id = serializers.IntegerField()
    user_name = serializers.CharField()
    user_email = serializers.EmailField()
    excluded = serializers.IntegerField()
    maybe = serializers.IntegerField()
    included = serializers.IntegerField()
    total = serializers.IntegerField()


class ReviewSerializer(serializers.ModelSerializer):
    user_role = serializers.SerializerMethodField()
    user_member_id = serializers.IntegerField(read_only=True)

    # annotated counts from queryset
    reference_count = serializers.IntegerField(read_only=True)
    duplicate_resolved_count = serializers.IntegerField(read_only=True)
    duplicate_not_duplicate_count = serializers.IntegerField(read_only=True)
    duplicate_deleted_count = serializers.IntegerField(read_only=True)
    duplicate_pairs_count = serializers.IntegerField(read_only=True)
    duplicate_pairs_unresolved_count = serializers.IntegerField(read_only=True)

    members = ReviewMemberSerializer(many=True, read_only=True)

    screening_stats = serializers.SerializerMethodField()
    screening_opinions = serializers.SerializerMethodField()
    full_text_opinions = serializers.SerializerMethodField()

    date_created = serializers.DateTimeField(format="%d %b %Y", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "title",
            "description",
            "is_active",
            "reference_count",
            "date_created",
            "is_blinded",
            "user_role",
            "user_member_id",
            "members",
            "screening_stats",
            "screening_opinions",
            "full_text_opinions",
            "duplicate_resolved_count",
            "duplicate_not_duplicate_count",
            "duplicate_deleted_count",
            "duplicate_pairs_unresolved_count",
            "duplicate_pairs_count",
        ]

    def get_user_role(self, obj):
        return getattr(obj, "user_role", None)

    def _get_user(self):
        return self.context.get("request").user

    def get_screening_stats(self, obj):
        user = self._get_user()

        qs = ScreeningStat.objects.filter(member__review=obj).select_related(
            "member__user"
        )

        if obj.is_blinded:
            qs = qs.filter(member__user=user)

        return ScreeningStatSerializer(qs.order_by("-seconds"), many=True).data

    def get_screening_opinions(self, obj):
        user = self._get_user()
        data = self.compute_opinion_stats(obj, ReferenceOpinion.Stage.SCREENING, user)
        return OpinionStatsSerializer(data, many=True).data

    def get_full_text_opinions(self, obj):
        user = self._get_user()
        data = self.compute_opinion_stats(obj, ReferenceOpinion.Stage.FULL_TEXT, user)
        return OpinionStatsSerializer(data, many=True).data

    def compute_opinion_stats(self, review, stage, user=None):
        """Optimised single-query aggregation for opinion stats."""

        qs = ReferenceOpinion.objects.filter(
            member__review=review,
            stage=stage,
        ).select_related("member__user")

        if review.is_blinded and user:
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
                excluded=Count("id", filter=Q(status=ReferenceOpinion.Status.EXCLUDED)),
                maybe=Count("id", filter=Q(status=ReferenceOpinion.Status.MAYBE)),
                included=Count("id", filter=Q(status=ReferenceOpinion.Status.INCLUDED)),
                total=Count("id"),
            )
            .order_by("-total")
        )

        return list(stats)

    def get_has_zotero_integration(self, obj):
        """Check if review has Zotero integration"""
        try:
            return obj.zotero_integration.is_configured
        except ZoteroIntegration.DoesNotExist:
            return False


class ReviewListSerializer(ModelSerializer):
    user_role = serializers.SerializerMethodField()
    date_created = serializers.DateTimeField(format="%d %b %Y")
    owner = serializers.StringRelatedField()
    reference_count = serializers.IntegerField(read_only=True)
    owner = serializers.SerializerMethodField()

    def get_user_role(self, obj):
        return getattr(obj, "user_role", None)

    def get_owner(self, obj):
        if not obj.owner_email:
            return None

        return f"{obj.owner_first_name} {obj.owner_last_name} ({obj.owner_email})"

    class Meta:
        model = Review
        fields = [
            "title",
            "date_created",
            "owner",
            "reference_count",
            "id",
            "user_role",
        ]


class ZoteroIntegrationSerializer(serializers.ModelSerializer):
    """Serializer for ZoteroIntegration (never exposes API key)"""

    is_configured = serializers.BooleanField(read_only=True)

    class Meta:
        model = ZoteroIntegration
        exclude = ["_api_key"]
        read_only_fields = [
            "last_push_at",
            "last_pull_at",
            "last_sync_version",
            "created_at",
            "updated_at",
        ]


class ZoteroConfigSerializer(serializers.Serializer):
    """Serializer for creating/updating Zotero credentials"""

    review = serializers.IntegerField(required=True, write_only=True)
    library_id = serializers.CharField(required=True, write_only=True)
    api_key = serializers.CharField(required=True, write_only=True)
    library_type = serializers.ChoiceField(
        choices=["user", "group"], default="user", required=False
    )
    collection_key = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )
    collection_name = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )

    def validate_library_id(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("Library ID must be numeric")
        return value

    def validate_api_key(self, value):
        if len(value) < 20:
            raise serializers.ValidationError("Invalid API key format")
        return value


class ZoteroSyncLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ZoteroSyncLog
        fields = "__all__"


class ZoteroStatusSerializer(serializers.Serializer):
    """Read-only serializer for Zotero status"""

    is_configured = serializers.BooleanField()
    library_type = serializers.CharField()
    collection_key = serializers.CharField(allow_null=True)
    collection_name = serializers.CharField(allow_null=True)
    last_push = serializers.DateTimeField(allow_null=True)
    last_pull = serializers.DateTimeField(allow_null=True)
    last_sync_version = serializers.IntegerField()
    total_references = serializers.IntegerField()
    synced_references = serializers.IntegerField()
    references_with_pdfs = serializers.IntegerField()
    recent_syncs = ZoteroSyncLogSerializer(many=True)


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


class BaseReferenceSerializer(serializers.ModelSerializer):
    search_method = serializers.StringRelatedField()

    class Meta:
        model = Reference
        fields = "__all__"
        read_only_fields = [
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


class ReferenceSerializer(BaseReferenceSerializer):
    opinions = serializers.SerializerMethodField()
    publication_date = serializers.DateField(format="%d/%m/%Y")
    labels = serializers.SerializerMethodField()
    assignee = serializers.SerializerMethodField()

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


class ReferenceOpinionSerializer(ModelSerializer):
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
        if status != ReferenceOpinion.Status.EXCLUDED:
            attrs["reason"] = None

        # If reason exists, ensure same review
        if reason and reference:
            if reason.review_id != reference.review_id:
                raise serializers.ValidationError(
                    {"reason": "Reason must belong to the same review."}
                )

        return attrs


class ReferenceDuplicatePairSerializer(ModelSerializer):
    reference1 = BaseReferenceSerializer(read_only=True)
    reference2 = BaseReferenceSerializer(read_only=True)

    class Meta:
        model = ReferenceDuplicatePair
        fields = ["id", "reference1", "reference2", "similarity_score"]


class KeywordSerializer(ModelSerializer):
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


class ReviewInvitationCreateSerializer(serializers.Serializer):
    review = serializers.IntegerField()
    emails = serializers.ListField(child=serializers.EmailField(), allow_empty=False)


class ReviewInvitationSerializer(ModelSerializer):
    review = serializers.StringRelatedField()
    invited_by = serializers.StringRelatedField()
    created_at = serializers.DateTimeField(format="%d %b %Y")

    class Meta:
        model = ReviewInvitation
        fields = "__all__"
        read_only_fields = ["created_at"]


class CodeSerializer(serializers.ModelSerializer):
    reference_file_url = serializers.SerializerMethodField()

    class Meta:
        model = Code
        fields = "__all__"
        read_only_fields = ["id", "member"]

    def get_reference_file_url(self, obj):
        request = self.context.get("request")

        if obj.reference and obj.reference.file:
            url = obj.reference.file.url
            return request.build_absolute_uri(url) if request else url

        return None


class SubThemeSerializer(serializers.ModelSerializer):
    code_ids = serializers.PrimaryKeyRelatedField(
        many=True, read_only=True, source="codes"
    )

    class Meta:
        model = SubTheme
        fields = ["id", "review", "name", "description", "code_ids", "main_theme"]
        read_only_fields = ["id", "code_ids"]


class MainThemeSerializer(serializers.ModelSerializer):
    sub_theme_ids = serializers.PrimaryKeyRelatedField(
        many=True, read_only=True, source="sub_themes"
    )

    class Meta:
        model = MainTheme
        fields = ["id", "review", "name", "description", "sub_theme_ids"]
        read_only_fields = ["id", "sub_theme_ids"]


class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ["id", "user", "name", "color"]
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


class ScreeningCriteriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScreeningCriteria
        fields = ["id", "review", "name", "description", "kind"]
        read_only_fields = ["id"]


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


def _validate_value_for_question(
    value: str, question: ExtractionQuestion
) -> float | None:
    """
    Validate *value* against *question.type*.
    Returns the numeric float when type == "number", else None.
    Raises serializers.ValidationError on any constraint violation.
    """
    qt = question.type
    v = (value or "").strip()

    if qt == ExtractionQuestion.QuestionType.FREE_TEXT:
        return None

    if qt == ExtractionQuestion.QuestionType.NUMBER:
        if v == "":
            return None
        try:
            return float(v)
        except ValueError:
            raise serializers.ValidationError(
                {"value": f"'{v}' is not a valid number for this question."}
            )

    if qt == ExtractionQuestion.QuestionType.DATE:
        if v == "":
            return None
        try:
            date.fromisoformat(v)
        except ValueError:
            raise serializers.ValidationError(
                {"value": f"'{v}' is not a valid ISO-8601 date (YYYY-MM-DD)."}
            )
        return None

    if qt == ExtractionQuestion.QuestionType.SINGLE_SELECT:
        if v == "":
            return None
        options = question.options or []
        if v not in options:
            raise serializers.ValidationError(
                {"value": f"'{v}' is not a valid option. Allowed: {options}"}
            )
        return None

    if qt == ExtractionQuestion.QuestionType.MULTI_SELECT:
        if v == "":
            return None
        options = set(question.options or [])
        chosen = [token.strip() for token in v.split(",") if token.strip()]
        invalid = [c for c in chosen if c not in options]
        if invalid:
            raise serializers.ValidationError(
                {"value": (f"Invalid option(s): {invalid}. Allowed: {sorted(options)}")}
            )
        return None

    if qt == ExtractionQuestion.QuestionType.BOOLEAN:
        if v == "":
            return None
        if v.lower() not in ("true", "false"):
            raise serializers.ValidationError(
                {"value": "Boolean questions only accept 'true' or 'false'."}
            )
        return None

    return None


class ExtractionSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtractionSection
        fields = ["id", "name", "order", "review"]
        read_only_fields = ["id"]

    def validate(self, data):
        review = data.get("review")
        name = data.get("name", "").strip()
        queryset = ExtractionSection.objects.filter(review=review, name__iexact=name)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                {"name": "A section with this name already exists for this review."}
            )
        return data

    def create(self, validated_data):
        validated_data["name"] = validated_data["name"].strip()
        if "order" not in validated_data:
            max_order = (
                ExtractionSection.objects.filter(
                    review=validated_data["review"]
                ).aggregate(models.Max("order"))["order__max"]
                or 0
            )
            validated_data["order"] = max_order + 1
        return super().create(validated_data)


class ExtractionQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtractionQuestion
        fields = [
            "id",
            "section",
            "question",
            "column_title",
            "type",
            "options",
            "required",
            "order",
        ]
        read_only_fields = ["id"]

    def validate_question(self, value):
        return value.strip() if value else value

    def validate_column_title(self, value):
        return value.strip() if value else value

    def validate(self, data):
        question_type = data.get("type")
        options = data.get("options")
        if question_type in ["single-select", "multi-select"]:
            if not options or not isinstance(options, list) or len(options) == 0:
                raise serializers.ValidationError(
                    {"options": "Options are required for select type questions."}
                )
        return data

    def create(self, validated_data):
        if "order" not in validated_data:
            section = validated_data["section"]
            max_order = (
                ExtractionQuestion.objects.filter(section=section).aggregate(
                    models.Max("order")
                )["order__max"]
                or 0
            )
            validated_data["order"] = max_order + 1
        return super().create(validated_data)


class ExtractionAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtractionAnswer
        fields = ["id", "reference", "question", "value"]
        read_only_fields = ["id"]

    def validate(self, data):
        """Enforce type constraints and populate value_number."""
        question = data.get("question") or (
            self.instance.question if self.instance else None
        )
        value = data.get("value", "")

        if question is None:
            return data

        # Run type validation; returns float | None
        numeric = _validate_value_for_question(value, question)
        # Stash for create/update
        data["_value_number"] = numeric
        return data

    def create(self, validated_data):
        value_number = validated_data.pop("_value_number", None)
        reference = validated_data["reference"]
        question = validated_data["question"]
        value = validated_data.get("value", "")

        answer, _ = ExtractionAnswer.objects.update_or_create(
            reference=reference,
            question=question,
            defaults={"value": value, "value_number": value_number},
        )
        return answer

    def update(self, instance, validated_data):
        value_number = validated_data.pop("_value_number", None)
        instance.value = validated_data.get("value", instance.value)
        instance.value_number = value_number
        instance.save()
        return instance


class ExtractionAnswerBulkSerializer(serializers.Serializer):
    reference_id = serializers.IntegerField()
    answers = serializers.DictField(child=serializers.CharField(allow_blank=True))

    def validate(self, data):
        """Validate each answer value against its question type."""
        answers_dict = data["answers"]

        errors = {}
        question_ids = [int(k) for k in answers_dict.keys()]
        questions_map = {
            q.id: q for q in ExtractionQuestion.objects.filter(id__in=question_ids)
        }

        for q_id_str, value in answers_dict.items():
            q_id = int(q_id_str)
            question = questions_map.get(q_id)
            if question is None:
                errors[q_id_str] = f"Question {q_id} does not exist."
                continue
            try:
                _validate_value_for_question(value, question)
            except serializers.ValidationError as exc:
                errors[q_id_str] = exc.detail

        if errors:
            raise serializers.ValidationError(errors)

        return data


class ExtractionQuestionTableSerializer(serializers.ModelSerializer):
    """Serializer for questions in the table view"""

    section_name = serializers.CharField(source="section.name", read_only=True)

    class Meta:
        model = ExtractionQuestion
        fields = [
            "id",
            "section",
            "section_name",
            "question",
            "column_title",
            "type",
            "required",
            "order",
            "options",
        ]


class ReferenceTableSerializer(serializers.ModelSerializer):
    """Serializer for references with their extraction answers"""

    answers = serializers.SerializerMethodField()
    labels = serializers.SerializerMethodField()
    assignee = serializers.SerializerMethodField()
    file = serializers.SerializerMethodField()

    class Meta:
        model = Reference
        fields = [
            "id",
            "title",
            "file",
            "answers",
            "is_extraction_completed",
            "labels",
            "assignee",
        ]

    def get_file(self, obj):
        request = self.context.get("request")

        if obj.file:
            url = obj.file.url
            return request.build_absolute_uri(url) if request else url

        return None

    def get_answers(self, obj):
        """Returns dict mapping question_id -> {id, value}"""
        # Access prefetched answers
        answers = {}
        for answer in obj.extraction_answers.all():
            answers[answer.question_id] = {"id": answer.id, "value": answer.value}
        return answers

    def get_labels(self, obj):
        """
        Return labels applied to this reference for the current user only.
        Expects that `obj` has a `prefetched_labels` prefetched attribute.
        """

        return [
            {"id": rl.label.id, "name": rl.label.name, "color": rl.label.color}
            for rl in obj.prefetched_labels
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


class ExtractionTableDataSerializer(serializers.Serializer):
    """Combined serializer for all table data"""

    questions = ExtractionQuestionTableSerializer(many=True)
    references = ReferenceTableSerializer(many=True)


class ExtractionAnswerNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtractionAnswer
        fields = ["id", "question", "value"]


class ExtractionQuestionWithAnswerSerializer(serializers.ModelSerializer):
    answer = serializers.SerializerMethodField()

    class Meta:
        model = ExtractionQuestion
        fields = [
            "id",
            "section",
            "question",
            "column_title",
            "type",
            "options",
            "required",
            "order",
            "answer",
        ]

    def get_answer(self, obj):
        # The answer will be prefetched and attached to the question object
        answer = getattr(obj, "user_answer", None)
        if answer:
            return {
                "id": answer.id,
                "value": answer.value,
            }
        return None


class ExtractionSectionWithQuestionsSerializer(serializers.ModelSerializer):
    questions = ExtractionQuestionWithAnswerSerializer(many=True)

    class Meta:
        model = ExtractionSection
        fields = ["id", "name", "order", "questions"]


class BatchAnswerSerializer(serializers.Serializer):
    """Serializer for batch answer updates"""

    reference_id = serializers.IntegerField()
    question_id = serializers.IntegerField()
    value = serializers.CharField(allow_blank=True)


class BulkUpdateExtractionStatusSerializer(serializers.Serializer):
    """Serializer for bulk updating extraction completion status"""

    reference_ids = serializers.ListField(
        child=serializers.IntegerField(), min_length=1
    )
    is_extraction_completed = serializers.BooleanField()


class LabelCountSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    color = serializers.CharField(allow_null=True)
    count = serializers.IntegerField()


class ArticleCountSerializer(serializers.Serializer):
    included = serializers.IntegerField()
    maybe = serializers.IntegerField()
    labeled = serializers.IntegerField()
    labels = LabelCountSerializer(many=True)


class AddDataSerializer(serializers.Serializer):
    data_source = serializers.ChoiceField(
        choices=["screening", "full-text"],
    )
    data_sink = serializers.ChoiceField(
        choices=["full-text", "extraction"],
    )
    article_types = serializers.ListField(
        child=serializers.ChoiceField(choices=["included", "maybe", "labeled"]),
    )
    label_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
    )

    def validate(self, attrs):
        source = attrs["data_source"]
        sink = attrs["data_sink"]

        if source == "full-text" and sink == "full-text":
            raise serializers.ValidationError(
                "Source and destination cannot both be full-text."
            )

        return attrs


class ReferenceOpinionUpsertSerializer(serializers.Serializer):
    reference_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        help_text="List of reference IDs to upsert opinions for",
    )
    status = serializers.ChoiceField(
        choices=ReferenceOpinion.Status.choices,
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
        if attrs["status"] != ReferenceOpinion.Status.EXCLUDED:
            attrs["reason"] = None
        return attrs


class ReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reason
        fields = ["id", "name", "review"]
        read_only_fields = ["id"]
