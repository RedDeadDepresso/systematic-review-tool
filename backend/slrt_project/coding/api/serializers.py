"""
Serializers for the coding app.

Organisation
------------
Model serializers
  CodeSerializer      — full CRUD; exposes computed reference_title and
                        reference_file_url via SerializerMethodFields.
  SubThemeSerializer  — CRUD; exposes a read-only list of associated Code PKs.
  MainThemeSerializer — CRUD; exposes a read-only list of child SubTheme PKs.
"""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from slrt_project.coding.models import Code, MainTheme, SubTheme


# ===========================================================================
# CodeSerializer
# ===========================================================================


class CodeSerializer(serializers.ModelSerializer):
    """
    Full serializer for Code instances.

    ``id`` and ``member`` are read-only: the id is a server-generated UUID
    and the member is always inferred from request.user by the view's
    perform_create so it can never be spoofed via the API.

    The two computed fields (``reference_title``, ``reference_file_url``)
    gracefully return None when the code has no linked reference or the
    reference has no file, avoiding attribute errors on optional FKs.
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

        Uses ``request.build_absolute_uri`` when a request is in context so
        the URL is scheme- and host-correct for the caller.  Falls back to the
        raw storage URL when no request is available (e.g. in shell scripts or
        management commands).
        """
        request = self.context.get("request")
        if obj.reference and obj.reference.file:
            url = obj.reference.file.url
            return request.build_absolute_uri(url) if request else url
        return None


# ===========================================================================
# SubThemeSerializer
# ===========================================================================


class SubThemeSerializer(serializers.ModelSerializer):
    """
    Serializer for SubTheme instances.

    ``code_ids`` is a flat list of PKs of all Codes assigned to this sub-theme.
    It is read-only because membership is managed on the Code itself (via
    Code.sub_theme FK) rather than on the sub-theme.
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


# ===========================================================================
# MainThemeSerializer
# ===========================================================================


class MainThemeSerializer(serializers.ModelSerializer):
    """
    Serializer for MainTheme instances.

    ``sub_theme_ids`` is a flat list of PKs of all SubThemes under this theme.
    It is read-only for the same reason as ``code_ids`` above.
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
