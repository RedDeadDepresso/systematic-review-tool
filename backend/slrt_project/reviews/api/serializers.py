from rest_framework import serializers

from slrt_project.integrations.models import ZoteroIntegration
from slrt_project.reviews.models import (
    Review,
    ReviewChatMessage,
    ReviewInvitation,
    ReviewMember,
    ScreeningCriteria,
    ScreeningStat,
    SearchMethod,
)
from slrt_project.users.api.serializers import UserSerializer


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
    reference_count = serializers.IntegerField(read_only=True, allow_null=True)

    duplicate_resolved_count = serializers.IntegerField(read_only=True)
    duplicate_not_duplicate_count = serializers.IntegerField(read_only=True)
    duplicate_deleted_count = serializers.IntegerField(read_only=True)
    duplicate_pairs_count = serializers.IntegerField(read_only=True, allow_null=True)
    duplicate_pairs_unresolved_count = serializers.IntegerField(
        read_only=True, allow_null=True
    )

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
            "duplicate_detection_status",
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

    def get_has_zotero_integration(self, obj):
        """Check if review has Zotero integration"""
        try:
            return obj.zotero_integration.is_configured
        except ZoteroIntegration.DoesNotExist:
            return False


class ReviewListSerializer(serializers.ModelSerializer):
    user_role = serializers.SerializerMethodField()
    date_created = serializers.DateTimeField(format="%d %b %Y")
    owner = serializers.StringRelatedField()
    reference_count = serializers.IntegerField(read_only=True, allow_null=True)
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


class ReviewInvitationCreateSerializer(serializers.Serializer):
    review = serializers.IntegerField()
    emails = serializers.ListField(child=serializers.EmailField(), allow_empty=False)


class ReviewInvitationSerializer(serializers.ModelSerializer):
    review = serializers.StringRelatedField()
    invited_by = serializers.StringRelatedField()
    created_at = serializers.DateTimeField(format="%d %b %Y")

    class Meta:
        model = ReviewInvitation
        fields = "__all__"
        read_only_fields = ["created_at"]


class ScreeningCriteriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScreeningCriteria
        fields = ["id", "review", "name", "description", "kind"]
        read_only_fields = ["id"]


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


class SearchMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = SearchMethod
        fields = ["id", "name"]
