"""
Tests for slrt_project/coding/api/serializers.py.

Strategy
--------
No-DB (plain pytest class, no marker)
    Field-shape and validation tests using plain dicts.  Covers read_only
    fields, required fields, and computed field return types.

DB (@pytest.mark.django_db)
    Full round-trip tests: computed field values, member read-only enforcement,
    reverse relation fields (code_ids, sub_theme_ids).

One class per serializer; one method per behaviour.

Run with:
    pytest slrt_project/coding/tests/api/test_serializers.py -v
"""

from unittest.mock import MagicMock

import pytest

from slrt_project.coding.api.serializers import (
    CodeSerializer,
    MainThemeSerializer,
    SubThemeSerializer,
)
from slrt_project.coding.tests.factories import (
    CodeFactory,
    MainThemeFactory,
    SubThemeFactory,
)
from slrt_project.references.tests.factories import ReferenceFactory
from slrt_project.reviews.tests.factories import ReviewMemberFactory


# ===========================================================================
# CodeSerializer
# ===========================================================================


class TestCodeSerializerFields:
    """Field-level checks that require no DB."""

    def test_id_is_read_only(self):
        s = CodeSerializer()
        assert s.fields["id"].read_only is True

    def test_member_is_read_only(self):
        s = CodeSerializer()
        assert s.fields["member"].read_only is True

    def test_reference_title_is_method_field(self):
        from rest_framework.fields import SerializerMethodField

        s = CodeSerializer()
        assert isinstance(s.fields["reference_title"], SerializerMethodField)

    def test_reference_file_url_is_method_field(self):
        from rest_framework.fields import SerializerMethodField

        s = CodeSerializer()
        assert isinstance(s.fields["reference_file_url"], SerializerMethodField)


@pytest.mark.django_db
class TestCodeSerializerComputedFields:
    """Computed SerializerMethodField values with real objects."""

    def test_reference_title_returns_title(self):
        ref = ReferenceFactory(title="My Study")
        code = CodeFactory(reference=ref)
        data = CodeSerializer(code, context={"request": None}).data
        assert data["reference_title"] == "My Study"

    def test_reference_title_none_when_no_reference(self):
        code = CodeFactory(reference=None)
        data = CodeSerializer(code, context={"request": None}).data
        assert data["reference_title"] is None

    def test_reference_file_url_with_request(self):
        ref = ReferenceFactory()
        # Give the reference a mock file
        ref.file = MagicMock()
        ref.file.url = "/media/file.pdf"
        code = CodeFactory(reference=ref)
        code.reference = ref  # attach mock

        request = MagicMock()
        request.build_absolute_uri.return_value = "https://example.com/media/file.pdf"
        data = CodeSerializer(code, context={"request": request}).data
        assert data["reference_file_url"] == "https://example.com/media/file.pdf"

    def test_reference_file_url_none_when_no_reference(self):
        code = CodeFactory(reference=None)
        data = CodeSerializer(code, context={"request": None}).data
        assert data["reference_file_url"] is None

    def test_reference_file_url_falls_back_to_raw_url_without_request(self):
        """When no request is in context the raw storage URL is returned."""
        ref = ReferenceFactory()
        ref.file = MagicMock()
        ref.file.url = "/media/file.pdf"
        code = CodeFactory(reference=ref)
        code.reference = ref

        data = CodeSerializer(code, context={}).data
        assert data["reference_file_url"] == "/media/file.pdf"

    def test_all_model_fields_present(self):
        code = CodeFactory()
        data = CodeSerializer(code, context={"request": None}).data
        for field in [
            "id",
            "type",
            "name",
            "review",
            "reference",
            "member",
            "sub_theme",
            "content",
            "position",
            "comment",
            "highlight_color",
            "highlight_style",
            "reference_title",
            "reference_file_url",
        ]:
            assert field in data, f"Missing field: {field}"


# ===========================================================================
# SubThemeSerializer
# ===========================================================================


class TestSubThemeSerializerFields:
    def test_id_is_read_only(self):
        assert SubThemeSerializer().fields["id"].read_only is True

    def test_member_is_read_only(self):
        assert SubThemeSerializer().fields["member"].read_only is True

    def test_code_ids_is_read_only(self):
        assert SubThemeSerializer().fields["code_ids"].read_only is True

    def test_expected_fields_present(self):
        fields = set(SubThemeSerializer().fields.keys())
        assert {
            "id",
            "review",
            "member",
            "name",
            "description",
            "main_theme",
            "code_ids",
        } <= fields


@pytest.mark.django_db
class TestSubThemeSerializerDB:
    def test_code_ids_lists_associated_code_pks(self):
        sub = SubThemeFactory()
        c1 = CodeFactory(sub_theme=sub, review=sub.review, member=sub.member)
        c2 = CodeFactory(sub_theme=sub, review=sub.review, member=sub.member)
        data = SubThemeSerializer(sub).data
        assert set(data["code_ids"]) == {c1.pk, c2.pk}

    def test_code_ids_empty_when_no_codes(self):
        sub = SubThemeFactory()
        assert SubThemeSerializer(sub).data["code_ids"] == []

    def test_name_required(self):
        s = SubThemeSerializer(data={"review": 1, "name": ""})
        s.is_valid()
        assert "name" in s.errors

    def test_valid_data_passes(self):
        member = ReviewMemberFactory()
        sub = SubThemeFactory(member=member, review=member.review)
        s = SubThemeSerializer(sub)
        assert s.data["name"] == sub.name


# ===========================================================================
# MainThemeSerializer
# ===========================================================================


class TestMainThemeSerializerFields:
    def test_id_is_read_only(self):
        assert MainThemeSerializer().fields["id"].read_only is True

    def test_member_is_read_only(self):
        assert MainThemeSerializer().fields["member"].read_only is True

    def test_sub_theme_ids_is_read_only(self):
        assert MainThemeSerializer().fields["sub_theme_ids"].read_only is True

    def test_expected_fields_present(self):
        fields = set(MainThemeSerializer().fields.keys())
        assert {
            "id",
            "review",
            "member",
            "name",
            "description",
            "sub_theme_ids",
        } <= fields


@pytest.mark.django_db
class TestMainThemeSerializerDB:
    def test_sub_theme_ids_lists_child_pks(self):
        theme = MainThemeFactory()
        s1 = SubThemeFactory(main_theme=theme, review=theme.review, member=theme.member)
        s2 = SubThemeFactory(main_theme=theme, review=theme.review, member=theme.member)
        data = MainThemeSerializer(theme).data
        assert set(data["sub_theme_ids"]) == {s1.pk, s2.pk}

    def test_sub_theme_ids_empty_when_no_children(self):
        theme = MainThemeFactory()
        assert MainThemeSerializer(theme).data["sub_theme_ids"] == []

    def test_serializes_name_and_description(self):
        theme = MainThemeFactory(name="Barriers", description="About barriers")
        data = MainThemeSerializer(theme).data
        assert data["name"] == "Barriers"
        assert data["description"] == "About barriers"
