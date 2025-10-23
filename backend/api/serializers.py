from collections import defaultdict

from rest_framework import serializers
from rest_framework.serializers import ModelSerializer

from api.models import Reference, Review, User


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

    def get_reference_count(self, obj):
        return obj.reference_set.count()

    class Meta:
        model = Review
        fields = ["title", "description", "is_active", "reference_count"]


class ReviewListSerializer(ModelSerializer):
    date_created = serializers.DateTimeField(format="%d %b %Y")
    owner = serializers.StringRelatedField()
    reference_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Review
        fields = ["title", "date_created", "owner", "reference_count", "id"]


class ReferenceSerializer(ModelSerializer):
    class Meta:
        model = Reference
        fields = [
            "title",
            "publication_types",
            "authors",
            "journal",
            "search_methods",
            "article_customizations",
            "abstract",
        ]


class ReferenceListSerializer(ModelSerializer):
    class Meta:
        model = Reference
        fields = ["title", "authors", "id"]
