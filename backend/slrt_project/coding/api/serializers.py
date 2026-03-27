from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from slrt_project.coding.models import Code, MainTheme, SubTheme


# CodeSerializer
class CodeSerializer(serializers.ModelSerializer):
    """
    Full serializer for Code instances.
    """

    # Human-readable title of the linked reference — None when no reference.
    reference_title = serializers.SerializerMethodField(
        help_text="Title of the linked reference, or null if none."
    )

    # Absolute URL to the reference's uploaded PDF — None when no file.
    reference_file_url = serializers.SerializerMethodField(
        help_text=(
            "Absolute URL to the reference's file. "
            "Built from request context so the URL is correct for the current host. "
            "Null when the reference has no file."
        )
    )

    class Meta:
        model = Code
        fields = "__all__"
        read_only_fields = ["id", "member"]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_reference_title(self, obj: Code) -> str | None:
        """Return the title of the linked reference, or None."""
        if obj.reference and obj.reference.title:
            return obj.reference.title
        return None

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_reference_file_url(self, obj: Code) -> str | None:
        """
        Return the absolute URL of the reference's uploaded file.
        """
        request = self.context.get("request")
        if obj.reference and obj.reference.file:
            url = obj.reference.file.url
            return request.build_absolute_uri(url) if request else url
        return None


# SubThemeSerializer
class SubThemeSerializer(serializers.ModelSerializer):
    """
    Serializer for SubTheme instances.
    """

    # Read-only reverse relation: PKs of all Codes under this sub-theme.
    code_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        read_only=True,
        source="codes",
        help_text="PKs of all Codes assigned to this sub-theme (read-only).",
    )

    class Meta:
        model = SubTheme
        fields = [
            "id",
            "review",
            "member",
            "name",
            "description",
            "main_theme",
            "code_ids",
        ]
        read_only_fields = ["id", "member", "code_ids"]


# MainThemeSerializer
class MainThemeSerializer(serializers.ModelSerializer):
    """
    Serializer for MainTheme instances.
    """

    # Read-only reverse relation: PKs of all SubThemes under this theme.
    sub_theme_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        read_only=True,
        source="sub_themes",
        help_text="PKs of all SubThemes under this main theme (read-only).",
    )

    class Meta:
        model = MainTheme
        fields = ["id", "review", "member", "name", "description", "sub_theme_ids"]
        read_only_fields = ["id", "member", "sub_theme_ids"]
