from collections import defaultdict

from rest_framework import serializers
from rest_framework.serializers import ModelSerializer

from api.models import (
    Code,
    Keyword,
    MainTheme,
    Note,
    Reference,
    ReferenceDuplicatePair,
    ReferenceOpinion,
    Review,
    ReviewInvitation,
    SubTheme,
    User,
)


class RegisterSerializer(ModelSerializer):
    email = serializers.EmailField(validators=[])
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "password", "confirm_password"]
        extra_kwargs = {"password": {"write_only": True}}

    def validate(self, data):
        """
        Check that the two password entries match.
        """
        detail = defaultdict(list)
        if User.objects.filter(email=data["email"]).exists():
            detail["Email"].append("A user with this email already exists.")
        if len(data["password"]) < 8:
            detail["Password"].append("Password must be at least 8 characters long.")
        if data["password"] != data["confirm_password"]:
            detail["Password"].append("Passwords do not match.")
        if detail:
            raise serializers.ValidationError(detail)
        return data

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        user = User.objects.create_user(**validated_data)
        return user


class ReviewSerializer(ModelSerializer):
    reference_count = serializers.SerializerMethodField()
    reference_duplicates_count = serializers.SerializerMethodField()
    date_created = serializers.DateTimeField(format="%d %b %Y", read_only=True)
    owner = serializers.CharField(read_only=True)

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
        ]
        read_only_fields = [
            "owner",
            "date_created",
            "reference_count",
            "reference_duplicates_count",
        ]


class ReviewListSerializer(ModelSerializer):
    date_created = serializers.DateTimeField(format="%d %b %Y")
    owner = serializers.StringRelatedField()
    reference_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Review
        fields = ["title", "date_created", "owner", "reference_count", "id"]


class ReferenceSerializer(serializers.ModelSerializer):
    opinions = serializers.SerializerMethodField()

    class Meta:
        model = Reference
        fields = "__all__"
        read_only_fields = [
            "id",
            "title",
            "publication_types",
            "authors",
            "journal",
            "search_methods",
            "article_customizations",
            "abstract",
        ]

    def get_opinions(self, obj):
        # Blinded -> return current user's opinion
        if hasattr(obj, "opinions_for_user"):
            if obj.opinions_for_user:
                op = obj.opinions_for_user[0]
                return {
                    "reviewer": str(op.reviewer),
                    "status": op.status,
                }
            return None

        # Not blinded -> return all opinions
        if hasattr(obj, "opinions_all"):
            return [
                {
                    "reviewer": str(op.reviewer),
                    "status": op.status,
                }
                for op in obj.opinions_all
            ]

        return None


class ReferenceOpinionSerializer(ModelSerializer):
    reviewer = serializers.StringRelatedField()

    class Meta:
        model = ReferenceOpinion
        fields = ["id", "reviewer", "status"]
        read_only_fields = ["id", "reviewer"]


class ReferenceDuplicatePairSerializer(ModelSerializer):
    reference1 = ReferenceSerializer(read_only=True)
    reference2 = ReferenceSerializer(read_only=True)

    class Meta:
        model = ReferenceDuplicatePair
        fields = ["id", "reference1", "reference2", "similarity_score"]


class KeywordSerializer(ModelSerializer):
    class Meta:
        model = Keyword
        fields = ["review", "name", "is_inclusive"]
        read_only_fields = ["review"]


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ["id", "author", "content", "date_created", "date_edited"]
        read_only_fields = ["author", "date_created", "date_edited"]


class ReviewInvitationSerializer(ModelSerializer):
    review = serializers.StringRelatedField()
    invited_by = serializers.StringRelatedField()
    created_at = serializers.DateTimeField(format="%d %b %Y")

    class Meta:
        model = ReviewInvitation
        fields = "__all__"


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
    codes = CodeSerializer(many=True, read_only=True)

    class Meta:
        model = SubTheme
        fields = ["id", "review", "name", "description", "codes"]
        read_only_fields = ["id", "codes"]


class MainThemeSerializer(serializers.ModelSerializer):
    sub_themes = SubThemeSerializer(many=True, read_only=True)

    class Meta:
        model = MainTheme
        fields = ["id", "review", "name", "description", "sub_themes"]
        read_only_fields = ["id", "sub_themes"]
