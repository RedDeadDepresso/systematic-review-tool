import os
from collections import defaultdict

from rest_framework import serializers
from rest_framework.serializers import ModelSerializer

from api.models import (
    Code,
    Keyword,
    Label,
    MainTheme,
    Note,
    Reference,
    ReferenceDuplicatePair,
    ReferenceLabel,
    ReferenceOpinion,
    Review,
    ReviewInvitation,
    SubTheme,
    UploadedPDF,
    User,
)


class UserSerializer(serializers.ModelSerializer):
    # Only for registration / write operations
    confirm_password = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False)
    display_name = serializers.SerializerMethodField()

    def get_display_name(self, obj):
        return str(obj)

    class Meta:
        model = User
        # Fields for retrieve & update
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "display_name",
            "password",
            "confirm_password",
        ]
        extra_kwargs = {
            "password": {"write_only": True, "required": False},
        }

    def validate(self, data):
        """
        Validate password only if provided.
        Also validate confirm_password if password is set.
        """
        detail = defaultdict(list)

        # Registration: check if password is provided
        password = data.get("password")
        confirm_password = data.get("confirm_password")
        email = data.get("email")

        # Email uniqueness check (only for registration)
        if (
            self.instance is None
            and email
            and User.objects.filter(email=email).exists()
        ):
            detail["email"].append("A user with this email already exists.")

        if password:
            if len(password) < 8:
                detail["password"].append(
                    "Password must be at least 8 characters long."
                )
            if password != confirm_password:
                detail["password"].append("Passwords do not match.")

        if detail:
            raise serializers.ValidationError(detail)

        return data

    def create(self, validated_data):
        """
        Create user with password
        """
        validated_data.pop("confirm_password", None)
        password = validated_data.pop("password", None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

    def update(self, instance, validated_data):
        """
        Update user fields. Handle password separately.
        """
        password = validated_data.pop("password", None)
        validated_data.pop("confirm_password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance


class ReviewSerializer(ModelSerializer):
    reference_count = serializers.SerializerMethodField()
    reference_duplicates_count = serializers.SerializerMethodField()
    date_created = serializers.DateTimeField(format="%d %b %Y", read_only=True)
    owner = UserSerializer(read_only=True)
    collaborators = UserSerializer(read_only=True, many=True)

    def get_reference_count(self, obj):
        return obj.reference_set.count()

    def get_reference_duplicates_count(self, obj):
        return obj.referenceduplicatepair_set.count()

    class Meta:
        model = Review
        fields = [
            "title",
            "description",
            "is_active",
            "reference_count",
            "reference_duplicates_count",
            "date_created",
            "owner",
            "is_blinded",
            "collaborators",
        ]
        read_only_fields = [
            "owner",
            "date_created",
            "reference_count",
            "reference_duplicates_count",
            "collaborators",
        ]


class ReviewListSerializer(ModelSerializer):
    date_created = serializers.DateTimeField(format="%d %b %Y")
    owner = serializers.StringRelatedField()
    reference_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Review
        fields = ["title", "date_created", "owner", "reference_count", "id"]


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
                "reviewer": {
                    "first_name": op.reviewer.first_name,
                    "last_name": op.reviewer.last_name,
                    "email": op.reviewer.email,
                },
                "status": op.status,
            }
            for op in opinions
        ]

    def get_labels(self, obj):
        """
        Return labels applied to this reference for the current user only.
        Expects that `obj` has a `user_labels` prefetched attribute.
        """
        user = self.context["request"].user
        # Fallback if prefetch not done
        reference_labels = getattr(obj, "user_labels", None)
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
            "first_name": obj.assignee.first_name,
            "last_name": obj.assignee.last_name,
            "email": obj.assignee.email,
        }


class ReferenceOpinionSerializer(ModelSerializer):
    reviewer = serializers.StringRelatedField()

    class Meta:
        model = ReferenceOpinion
        fields = ["id", "reviewer", "status"]
        read_only_fields = ["id", "reviewer"]


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
    class Meta:
        model = Note
        fields = ["id", "author", "content", "date_created", "date_edited"]
        read_only_fields = ["author", "date_created", "date_edited"]


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
        read_only_fields = ["id", "user"]

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
        fields = ["id", "user", "name"]
        read_only_fields = ["user"]

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
