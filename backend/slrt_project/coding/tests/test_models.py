"""
Tests for slrt_project/coding/models.py.

Strategy
--------
No-DB (plain pytest class, no marker)
    Uses _make() to construct unsaved model instances entirely in memory.
    Covers __str__, field defaults, choice enumerations, and Meta options —
    anything that is pure Python with no ORM involvement.

DB (@pytest.mark.django_db)
    Uses factories for full round-trip tests: cascade/SET_NULL delete
    behaviour, UUID primary key generation, factory correctness, and
    constraint enforcement.

_make() technique
-----------------
Django's FK descriptor reads from _state.fields_cache, not __dict__.
_make() constructs an instance without hitting the DB; it is only safe for
non-FK fields.  Any test that accesses a FK attribute (e.g. self.review)
must use @pytest.mark.django_db + factories.

Run with:
    pytest slrt_project/coding/tests/test_models.py -v
"""

import uuid

import pytest
from django.db.models.base import ModelState

from slrt_project.coding.models import Code, MainTheme, SubTheme
from slrt_project.coding.tests.factories import (
    CodeFactory,
    MainThemeFactory,
    SubThemeFactory,
)
from slrt_project.references.tests.factories import ReferenceFactory


# ---------------------------------------------------------------------------
# Helper — build unsaved instances without touching the DB
# ---------------------------------------------------------------------------


def _make(model_cls, **kwargs):
    """
    Construct an unsaved model instance without any DB access.

    Sets only scalar (non-FK) fields via __dict__.  FK fields are not
    populated, so __str__ implementations that traverse FKs will fail — use
    factories + @pytest.mark.django_db for those cases.
    """
    instance = model_cls.__new__(model_cls)
    instance._state = ModelState()
    instance._state.fields_cache = {}
    instance.__dict__["id"] = None
    instance.__dict__.update(kwargs)
    return instance


# ===========================================================================
# MainTheme — no-DB tests
# ===========================================================================


class TestMainThemeStr:
    def test_returns_name(self):
        theme = _make(MainTheme, name="Barriers to access")
        assert str(theme) == "Barriers to access"

    def test_empty_name(self):
        theme = _make(MainTheme, name="")
        assert str(theme) == ""


class TestMainThemeMeta:
    def test_default_ordering_by_name(self):
        assert MainTheme._meta.ordering == ["name"]

    def test_name_max_length(self):
        field = MainTheme._meta.get_field("name")
        assert field.max_length == 150

    def test_description_is_blank(self):
        field = MainTheme._meta.get_field("description")
        assert field.blank is True

    def test_review_cascade(self):
        field = MainTheme._meta.get_field("review")
        assert field.remote_field.on_delete.__name__ == "CASCADE"

    def test_member_cascade(self):
        field = MainTheme._meta.get_field("member")
        assert field.remote_field.on_delete.__name__ == "CASCADE"


# ===========================================================================
# MainTheme — DB tests
# ===========================================================================


@pytest.mark.django_db(transaction=True)
class TestMainThemeDB:
    def test_factory_creates_row(self):
        theme = MainThemeFactory(name="Facilitators")
        assert theme.pk is not None
        assert MainTheme.objects.filter(pk=theme.pk).exists()

    def test_review_and_member_are_consistent(self):
        # The factory ensures both FKs point to the same review.
        theme = MainThemeFactory()
        assert theme.review == theme.member.review

    def test_cascade_delete_with_review(self):
        theme = MainThemeFactory()
        pk = theme.pk
        theme.review.delete()
        assert not MainTheme.objects.filter(pk=pk).exists()

    def test_cascade_delete_with_member(self):
        theme = MainThemeFactory()
        pk = theme.pk
        theme.member.delete()
        assert not MainTheme.objects.filter(pk=pk).exists()

    def test_str_db(self):
        theme = MainThemeFactory(name="Barriers")
        assert str(theme) == "Barriers"


# ===========================================================================
# SubTheme — no-DB tests
# ===========================================================================


class TestSubThemeStr:
    def test_returns_name(self):
        sub = _make(SubTheme, name="Cost barriers")
        assert str(sub) == "Cost barriers"

    def test_empty_name(self):
        sub = _make(SubTheme, name="")
        assert str(sub) == ""


class TestSubThemeMeta:
    def test_default_ordering_by_name(self):
        assert SubTheme._meta.ordering == ["name"]

    def test_name_max_length(self):
        assert SubTheme._meta.get_field("name").max_length == 150

    def test_description_is_blank(self):
        assert SubTheme._meta.get_field("description").blank is True

    def test_main_theme_set_null(self):
        field = SubTheme._meta.get_field("main_theme")
        assert field.null is True
        assert field.blank is True
        assert field.remote_field.on_delete.__name__ == "SET_NULL"

    def test_related_name_on_main_theme(self):
        field = SubTheme._meta.get_field("main_theme")
        assert field.remote_field.related_name == "sub_themes"


# ===========================================================================
# SubTheme — DB tests
# ===========================================================================


@pytest.mark.django_db
class TestSubThemeDB:
    def test_factory_creates_row(self):
        sub = SubThemeFactory(name="Geographic barriers")
        assert sub.pk is not None
        assert SubTheme.objects.filter(pk=sub.pk).exists()

    def test_review_and_member_consistent(self):
        sub = SubThemeFactory()
        assert sub.review == sub.member.review

    def test_main_theme_in_same_review(self):
        sub = SubThemeFactory()
        assert sub.main_theme.review == sub.review

    def test_standalone_sub_theme(self):
        # main_theme=None is valid (nullable FK).
        sub = SubThemeFactory(main_theme=None)
        assert sub.main_theme is None

    def test_main_theme_delete_sets_null(self):
        # Deleting the parent theme must NOT delete the sub-theme.
        sub = SubThemeFactory()
        sub.main_theme.delete()
        sub.refresh_from_db()
        assert sub.main_theme is None

    def test_review_delete_cascades(self):
        sub = SubThemeFactory()
        pk = sub.pk
        sub.review.delete()
        assert not SubTheme.objects.filter(pk=pk).exists()

    def test_reverse_relation_on_main_theme(self):
        theme = MainThemeFactory()
        sub1 = SubThemeFactory(
            main_theme=theme, review=theme.review, member=theme.member
        )
        sub2 = SubThemeFactory(
            main_theme=theme, review=theme.review, member=theme.member
        )
        assert sub1 in theme.sub_themes.all()
        assert sub2 in theme.sub_themes.all()


# ===========================================================================
# Code.HighlightType choices — no-DB
# ===========================================================================


class TestHighlightType:
    def test_all_six_types_exist(self):
        db_values = {c[0] for c in Code.HighlightType.choices}
        assert db_values == {"text", "area", "freetext", "image", "drawing", "shape"}

    def test_display_labels(self):
        labels = {c[1] for c in Code.HighlightType.choices}
        assert "Text" in labels
        assert "Free text" in labels
        assert "Drawing" in labels


# ===========================================================================
# Code.HighlightStyle choices — no-DB
# ===========================================================================


class TestHighlightStyle:
    def test_all_three_styles_exist(self):
        db_values = {c[0] for c in Code.HighlightStyle.choices}
        assert db_values == {"highlight", "underline", "strikethrough"}

    def test_display_labels(self):
        labels = {c[1] for c in Code.HighlightStyle.choices}
        assert "Highlight" in labels
        assert "Underline" in labels
        assert "Strikethrough" in labels


# ===========================================================================
# Code — no-DB meta tests
# ===========================================================================


class TestCodeMeta:
    def test_default_ordering_by_name(self):
        assert Code._meta.ordering == ["name"]

    def test_id_is_uuid(self):
        field = Code._meta.get_field("id")
        assert field.primary_key is True
        assert field.default is uuid.uuid4

    def test_id_not_editable(self):
        assert Code._meta.get_field("id").editable is False

    def test_name_not_blank(self):
        assert Code._meta.get_field("name").blank is False

    def test_type_nullable(self):
        field = Code._meta.get_field("type")
        assert field.null is True
        assert field.blank is True

    def test_reference_set_null(self):
        field = Code._meta.get_field("reference")
        assert field.null is True
        assert field.remote_field.on_delete.__name__ == "SET_NULL"

    def test_sub_theme_set_null(self):
        field = Code._meta.get_field("sub_theme")
        assert field.null is True
        assert field.remote_field.on_delete.__name__ == "SET_NULL"

    def test_content_nullable_json(self):
        field = Code._meta.get_field("content")
        assert field.null is True
        assert field.blank is True

    def test_position_nullable_json(self):
        field = Code._meta.get_field("position")
        assert field.null is True
        assert field.blank is True

    def test_highlight_color_max_length(self):
        assert Code._meta.get_field("highlight_color").max_length == 50

    def test_highlight_style_max_length(self):
        assert Code._meta.get_field("highlight_style").max_length == 20

    def test_comment_nullable(self):
        field = Code._meta.get_field("comment")
        assert field.null is True
        assert field.blank is True


# ===========================================================================
# Code.__str__ — no-DB
# ===========================================================================


class TestCodeStr:
    def test_returns_name(self):
        code = _make(Code, name="Participant quote about cost")
        assert str(code) == "Participant quote about cost"

    def test_empty_name(self):
        code = _make(Code, name="")
        assert str(code) == ""


# ===========================================================================
# Code — DB tests
# ===========================================================================


@pytest.mark.django_db
class TestCodeDB:
    def test_factory_creates_row(self):
        code = CodeFactory()
        assert Code.objects.filter(pk=code.pk).exists()

    def test_pk_is_uuid(self):
        code = CodeFactory()
        assert isinstance(code.pk, uuid.UUID)

    def test_two_codes_have_different_uuids(self):
        c1, c2 = CodeFactory(), CodeFactory()
        assert c1.pk != c2.pk

    def test_review_member_consistent(self):
        code = CodeFactory()
        assert code.review == code.member.review

    # --- trait: text --------------------------------------------------------
    def test_text_trait(self):
        code = CodeFactory(text=True)
        assert code.type == Code.HighlightType.TEXT
        assert code.highlight_color is not None
        assert code.highlight_style == Code.HighlightStyle.HIGHLIGHT

    # --- trait: area --------------------------------------------------------
    def test_area_trait(self):
        code = CodeFactory(area=True)
        assert code.type == Code.HighlightType.AREA

    # --- trait: freetext ----------------------------------------------------
    def test_freetext_trait_clears_position_and_content(self):
        code = CodeFactory(freetext=True)
        assert code.type == Code.HighlightType.FREETEXT
        assert code.content is None
        assert code.position is None
        assert code.highlight_color is None
        assert code.highlight_style is None

    # --- trait: image -------------------------------------------------------
    def test_image_trait(self):
        code = CodeFactory(image=True)
        assert code.type == Code.HighlightType.IMAGE
        assert "image" in (code.content or {})

    # --- FK relationships ---------------------------------------------------
    def test_reference_optional(self):
        code = CodeFactory(reference=None)
        assert code.reference is None

    def test_sub_theme_optional(self):
        code = CodeFactory(sub_theme=None)
        assert code.sub_theme is None

    def test_reference_delete_sets_null(self):
        ref = ReferenceFactory()
        code = CodeFactory(reference=ref)
        ref.delete()
        code.refresh_from_db()
        assert code.reference is None

    def test_sub_theme_delete_sets_null(self):
        sub = SubThemeFactory()
        code = CodeFactory(
            sub_theme=sub,
            review=sub.review,
            member=sub.member,
        )
        sub.delete()
        code.refresh_from_db()
        assert code.sub_theme is None

    def test_review_delete_cascades(self):
        code = CodeFactory()
        pk = code.pk
        code.review.delete()
        assert not Code.objects.filter(pk=pk).exists()

    def test_member_delete_cascades(self):
        code = CodeFactory()
        pk = code.pk
        code.member.delete()
        assert not Code.objects.filter(pk=pk).exists()

    # --- JSON fields --------------------------------------------------------
    def test_content_stored_and_retrieved(self):
        payload = {"text": "a passage about barriers"}
        code = CodeFactory(content=payload)
        code.refresh_from_db()
        assert code.content == payload

    def test_position_stored_and_retrieved(self):
        payload = {"pageNumber": 3, "rects": []}
        code = CodeFactory(position=payload)
        code.refresh_from_db()
        assert code.position == payload

    # --- reverse relations --------------------------------------------------
    def test_codes_reverse_on_reference(self):
        ref = ReferenceFactory()
        code = CodeFactory(reference=ref)
        assert code in ref.codes.all()

    def test_codes_reverse_on_sub_theme(self):
        sub = SubThemeFactory()
        code = CodeFactory(sub_theme=sub, review=sub.review, member=sub.member)
        assert code in sub.codes.all()
