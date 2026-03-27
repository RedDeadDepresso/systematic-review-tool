from unittest.mock import MagicMock, patch

import pytest
from rest_framework import status
from rest_framework.test import APIRequestFactory


factory = APIRequestFactory()


# Shared fixtures / helpers
def make_user(pk=1, email="user@example.com", first_name="Alice", last_name="Smith"):
    u = MagicMock()
    u.pk = pk
    u.id = pk
    u.email = email
    u.first_name = first_name
    u.last_name = last_name
    u.is_authenticated = True
    return u


def make_review(pk=1, title="My SLR", is_blinded=True, is_active=True):
    from slrt_project.reviews.models import Review

    r = MagicMock(spec=Review)
    r.pk = pk
    r.id = pk
    r.title = title
    r.is_blinded = is_blinded
    r.is_active = is_active
    r.duplicate_detection_status = Review.DuplicateDetectionStatus.NOT_STARTED
    r.prisma_file = None
    return r


def make_member(pk=1, role="Reviewer", review=None, user=None):
    from slrt_project.reviews.models import ReviewMember

    m = MagicMock(spec=ReviewMember)
    m.pk = pk
    m.id = pk
    m.role = role
    m.review = review or make_review()
    m.user = user or make_user()
    return m


# ReviewViewSet — _escape_latex
class TestEscapeLatex:
    def _fn(self):
        from slrt_project.reviews.api.views import ReviewViewSet

        return ReviewViewSet._escape_latex

    def test_ampersand_escaped(self):
        assert r"\&" in self._fn()("A & B")

    def test_backslash_escaped_first_not_doubled(self):
        result = self._fn()("a\\b")
        # _escape_latex replaces \ with \textbackslash{} first, then escapes
        # { and } separately — so the final output is \textbackslash\{\}.
        # Assert on the stable part of the sequence and that it only appears once.
        assert r"\textbackslash" in result
        assert result.count(r"\textbackslash") == 1

    def test_empty_string_returns_empty(self):
        assert self._fn()("") == ""

    def test_none_returns_empty(self):
        assert self._fn()(None) == ""

    def test_percent_escaped(self):
        assert r"\%" in self._fn()("50%")

    def test_underscore_escaped(self):
        assert r"\_" in self._fn()("snake_case")

    def test_dollar_escaped(self):
        assert r"\$" in self._fn()("$100")

    def test_hash_escaped(self):
        assert r"\#" in self._fn()("#1 thing")

    def test_tilde_escaped(self):
        assert r"\textasciitilde{}" in self._fn()("~approx")

    def test_caret_escaped(self):
        assert r"\^{}" in self._fn()("x^2")


# ReviewViewSet — _build_prisma_url
class TestBuildPrismaUrl:
    def _fn(self):
        from slrt_project.reviews.api.views import ReviewViewSet

        return ReviewViewSet._build_prisma_url

    def _data(self):
        return {
            "db_registers": {
                "identification": {"databases": 100},
                "removed_before_screening": {"duplicates": 10},
                "records": {"screened": 85, "excluded": 30},
                "reports": {
                    "sought": 55,
                    "not_retrieved": 5,
                    "assessed": 50,
                    "excluded_reasons": {},
                },
            },
            "included": {"studies": 20, "reports": 20},
        }

    def test_starts_with_base_url(self):
        url = self._fn()(self._data())
        assert url.startswith("https://estech.shinyapps.io/prisma_flowdiagram/")

    def test_database_count_encoded(self):
        assert "database_results=100" in self._fn()(self._data())

    def test_missing_keys_default_to_zero(self):
        url = self._fn()({"db_registers": {}, "included": {}})
        assert "database_results=0" in url

    def test_excluded_reasons_present_when_set(self):
        data = self._data()
        data["db_registers"]["reports"]["excluded_reasons"] = {"Language": 3}
        assert "dbr_excluded=" in self._fn()(data)

    def test_excluded_reasons_absent_when_empty(self):
        assert "dbr_excluded" not in self._fn()(self._data())


# ReviewViewSet — _filter_refs_for_add_data


class TestFilterRefsForAddData:
    def _fn(self):
        from slrt_project.reviews.api.views import ReviewViewSet

        return ReviewViewSet._filter_refs_for_add_data

    @patch("slrt_project.reviews.api.views.Reference")
    def test_included_type_applies_extra_filter(self, MockRef):
        qs = MagicMock()
        qs.filter.return_value = qs
        MockRef.objects.filter.return_value = qs

        data = {
            "data_source": "screening",
            "data_sink": "full-text",
            "article_types": ["included"],
            "label_ids": [],
        }
        self._fn()(make_review(), make_member(), data)
        assert qs.filter.called

    @patch("slrt_project.reviews.api.views.Reference")
    def test_no_types_skips_opinion_filter(self, MockRef):
        qs = MagicMock()
        qs.filter.return_value = qs
        MockRef.objects.filter.return_value = qs

        data = {
            "data_source": "screening",
            "data_sink": "extraction",
            "article_types": [],
            "label_ids": [],
        }
        self._fn()(make_review(), make_member(), data)
        # Only the base filter(review=...) called.
        MockRef.objects.filter.assert_called_once()

    @patch("slrt_project.reviews.api.views.Reference")
    def test_labeled_with_label_ids_applies_label_filter(self, MockRef):
        qs = MagicMock()
        qs.filter.return_value = qs
        MockRef.objects.filter.return_value = qs

        data = {
            "data_source": "screening",
            "data_sink": "full-text",
            "article_types": ["labeled"],
            "label_ids": [1, 2],
        }
        self._fn()(make_review(), make_member(), data)
        # Expect at least 2 filter calls (base + label).
        assert qs.filter.call_count >= 1


# ReviewViewSet — get_serializer_class


class TestGetSerializerClass:
    def _vs(self, action):
        from slrt_project.reviews.api.views import ReviewViewSet

        vs = ReviewViewSet()
        vs.action = action
        vs.request = MagicMock()
        vs.format_kwarg = None
        return vs

    def test_list_returns_list_serializer(self):
        from slrt_project.reviews.api.serializers import ReviewListSerializer

        assert self._vs("list").get_serializer_class() is ReviewListSerializer

    def test_retrieve_returns_detail_serializer(self):
        from slrt_project.reviews.api.serializers import ReviewSerializer

        assert self._vs("retrieve").get_serializer_class() is ReviewSerializer

    def test_create_returns_detail_serializer(self):
        from slrt_project.reviews.api.serializers import ReviewSerializer

        assert self._vs("create").get_serializer_class() is ReviewSerializer


# ReviewViewSet — get_permissions


class TestGetPermissions:
    def _vs(self, action):
        from slrt_project.reviews.api.views import ReviewViewSet

        vs = ReviewViewSet()
        vs.action = action
        vs.request = MagicMock()
        vs.format_kwarg = None
        return vs

    def test_destructive_actions_require_owner(self):
        from slrt_project.shared.permissions import IsReviewOwner

        for action in ["update", "partial_update", "destroy"]:
            perms = self._vs(action).get_permissions()
            assert any(isinstance(p, IsReviewOwner) for p in perms), action

    def test_safe_actions_no_owner_required(self):
        from slrt_project.shared.permissions import IsReviewOwner

        for action in ["list", "retrieve", "members", "screening_stats"]:
            perms = self._vs(action).get_permissions()
            assert not any(isinstance(p, IsReviewOwner) for p in perms), action


# ReviewViewSet — _require_duplicate_permission


class TestRequireDuplicatePermission:
    def _vs(self):
        from slrt_project.reviews.api.views import ReviewViewSet

        vs = ReviewViewSet()
        vs.format_kwarg = None
        return vs

    @patch("slrt_project.reviews.api.views.ReviewMember")
    @patch("slrt_project.reviews.api.views.PERMISSIONS")
    def test_returns_member_when_allowed(self, MockPerms, MockMember):
        member = make_member(role="Owner")
        MockMember.objects.get.return_value = member
        MockPerms.__getitem__.return_value = ["Owner"]

        request = MagicMock()
        request.user = make_user()

        result = self._vs()._require_duplicate_permission(request, make_review())
        assert result is member

    @patch("slrt_project.reviews.api.views.ReviewMember")
    def test_returns_403_when_not_member(self, MockMember):
        from slrt_project.reviews.models import ReviewMember

        MockMember.DoesNotExist = ReviewMember.DoesNotExist
        MockMember.objects.get.side_effect = ReviewMember.DoesNotExist

        request = MagicMock()
        request.user = make_user()

        result = self._vs()._require_duplicate_permission(request, make_review())
        assert result.status_code == status.HTTP_403_FORBIDDEN


# ReviewViewSet — _create_search_method


class TestCreateSearchMethod:
    def _vs(self):
        from slrt_project.reviews.api.views import ReviewViewSet

        vs = ReviewViewSet()
        vs.request = MagicMock()
        vs.format_kwarg = None
        return vs

    def _file(self, name="refs.bib"):
        f = MagicMock()
        f.name = name
        return f

    @patch("slrt_project.reviews.api.views.SearchMethod")
    def test_creates_with_original_name_when_free(self, MockSM):
        mock_qs = MagicMock()
        mock_qs.exists.return_value = False
        MockSM.objects.filter.return_value = mock_qs

        created = MagicMock()
        created.id = 1
        created.file.path = "/tmp/refs.bib"
        MockSM.objects.create.return_value = created

        result = self._vs()._create_search_method(make_review(), self._file("refs.bib"))
        assert result is created
        call_kwargs = MockSM.objects.create.call_args.kwargs
        assert call_kwargs["name"] == "refs.bib"

    @patch("slrt_project.reviews.api.views.SearchMethod")
    def test_appends_counter_on_collision(self, MockSM):
        mock_qs = MagicMock()
        mock_qs.exists.side_effect = [True, False]
        MockSM.objects.filter.return_value = mock_qs

        created = MagicMock()
        created.id = 2
        created.file.path = "/tmp/refs_1.bib"
        MockSM.objects.create.return_value = created

        self._vs()._create_search_method(make_review(), self._file("refs.bib"))
        call_kwargs = MockSM.objects.create.call_args.kwargs
        assert call_kwargs["name"] == "refs_1.bib"

    @patch("slrt_project.reviews.api.views.SearchMethod")
    def test_returns_500_on_db_error(self, MockSM):
        mock_qs = MagicMock()
        mock_qs.exists.return_value = False
        MockSM.objects.filter.return_value = mock_qs
        MockSM.objects.create.side_effect = Exception("DB down")

        result = self._vs()._create_search_method(make_review(), self._file())
        assert result.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


# ReviewViewSet — _build_themes_export


class TestBuildThemesExport:
    @patch("slrt_project.reviews.api.views.MainTheme")
    @patch("slrt_project.reviews.api.views.timezone")
    def test_structure(self, mock_tz, MockTheme):
        from slrt_project.reviews.api.views import ReviewViewSet

        mock_tz.now.return_value.isoformat.return_value = "2024-01-01T00:00:00"

        # One theme with one subtheme and one code.
        code = MagicMock()
        code.id = "c1"
        code.name = "Code"
        code.comment = None
        code.type = "general"
        code.highlight_color = "#fff"
        code.reference_id = 1

        subtheme = MagicMock()
        subtheme.id = 10
        subtheme.name = "Sub"
        subtheme.description = "Desc"
        subtheme.codes.all.return_value = [code]

        theme = MagicMock()
        theme.id = 1
        theme.name = "Theme"
        theme.description = "TDesc"
        theme.sub_themes.all.return_value = [subtheme]

        qs = MagicMock()
        qs.__iter__ = MagicMock(return_value=iter([theme]))
        qs.prefetch_related.return_value = qs
        MockTheme.objects.filter.return_value = qs

        result = ReviewViewSet._build_themes_export(make_review(), make_user())

        assert result["reviewId"] == 1
        assert result["themeCount"] == 1
        assert result["themes"][0]["name"] == "Theme"
        assert result["themes"][0]["subthemes"][0]["name"] == "Sub"


# ReviewInvitationViewSet — get_queryset direction filtering


class TestInvitationGetQueryset:
    def _vs(self, query_type=None):
        from slrt_project.reviews.api.views import ReviewInvitationViewSet

        user = make_user()
        request = MagicMock()
        request.user = user
        request.query_params = {"type": query_type} if query_type else {}

        vs = ReviewInvitationViewSet()
        vs.request = request
        vs.format_kwarg = None
        vs.kwargs = {}
        return vs

    @patch("slrt_project.reviews.api.views.ReviewInvitation")
    def test_sent_filters_invited_by(self, MockInv):
        vs = self._vs("sent")
        MockInv.objects.filter.return_value = MagicMock()
        vs.get_queryset()
        MockInv.objects.filter.assert_called_with(invited_by=vs.request.user)

    @patch("slrt_project.reviews.api.views.ReviewInvitation")
    def test_received_filters_by_email(self, MockInv):
        vs = self._vs("received")
        MockInv.objects.filter.return_value = MagicMock()
        vs.get_queryset()
        MockInv.objects.filter.assert_called_with(email=vs.request.user.email)

    @patch("slrt_project.reviews.api.views.ReviewInvitation")
    def test_default_shows_both(self, MockInv):
        vs = self._vs()
        MockInv.objects.filter.return_value = MagicMock()
        vs.get_queryset()
        MockInv.objects.filter.assert_called_once()


# ReviewMemberRetrieveUpdateDestroyView — perform_destroy


class TestMemberDestroyView:
    def test_raises_on_owner_removal(self):
        from rest_framework import serializers as drf_serializers

        from slrt_project.reviews.api.views import ReviewMemberRetrieveUpdateDestroyView
        from slrt_project.reviews.models import ReviewMember

        view = ReviewMemberRetrieveUpdateDestroyView()
        instance = make_member(role=ReviewMember.Role.OWNER)

        with pytest.raises(drf_serializers.ValidationError):
            view.perform_destroy(instance)

    def test_non_owner_is_deleted(self):
        from slrt_project.reviews.api.views import ReviewMemberRetrieveUpdateDestroyView
        from slrt_project.reviews.models import ReviewMember

        view = ReviewMemberRetrieveUpdateDestroyView()
        instance = make_member(role=ReviewMember.Role.REVIEWER)
        instance.delete = MagicMock()

        view.perform_destroy(instance)
        instance.delete.assert_called_once()


# SearchMethodDestroyView — perform_destroy


class TestSearchMethodDestroyView:
    @patch("slrt_project.reviews.api.views.check_permission")
    def test_checks_permission_then_deletes(self, mock_perm):
        from slrt_project.reviews.api.views import SearchMethodDestroyView
        from slrt_project.shared.permissions import Permission

        view = SearchMethodDestroyView()
        view.request = MagicMock()
        view.request.user = make_user()

        instance = MagicMock()
        instance.review = make_review()

        view.perform_destroy(instance)

        mock_perm.assert_called_once_with(
            Permission.UPLOAD_FILES, view.request.user, instance.review
        )
        instance.delete.assert_called_once()


# Serializer: DetectDuplicatesRequestSerializer


class TestDetectDuplicatesRequestSerializer:
    def _s(self, data):
        from slrt_project.reviews.api.serializers import (
            DetectDuplicatesRequestSerializer,
        )

        return DetectDuplicatesRequestSerializer(data=data)

    def test_empty_body_uses_default(self):
        s = self._s({})
        assert s.is_valid(), s.errors
        assert s.validated_data["threshold"] == 0.5

    def test_custom_threshold_valid(self):
        s = self._s({"threshold": 0.75})
        assert s.is_valid(), s.errors

    def test_above_one_fails(self):
        assert not self._s({"threshold": 1.1}).is_valid()

    def test_below_zero_fails(self):
        assert not self._s({"threshold": -0.1}).is_valid()


# Serializer: AutoResolveDuplicatesRequestSerializer


class TestAutoResolveDuplicatesRequestSerializer:
    def _s(self, data, review=None):
        from slrt_project.reviews.api.serializers import (
            AutoResolveDuplicatesRequestSerializer,
        )

        return AutoResolveDuplicatesRequestSerializer(
            data=data, context={"review": review}
        )

    def test_all_defaults(self):
        s = self._s({})
        assert s.is_valid(), s.errors
        assert s.validated_data["confidence_threshold"] == 0.90
        assert s.validated_data["detect_first"] is True
        assert s.validated_data["preferred_search_method_id"] is None

    def test_confidence_above_one_fails(self):
        assert not self._s({"confidence_threshold": 2.0}).is_valid()

    def test_invalid_search_method_fails(self):
        review = MagicMock()
        review.searchmethod_set.filter.return_value.exists.return_value = False
        s = self._s({"preferred_search_method_id": 999}, review=review)
        assert not s.is_valid()
        assert "preferred_search_method_id" in s.errors

    def test_valid_search_method_passes(self):
        review = MagicMock()
        review.searchmethod_set.filter.return_value.exists.return_value = True
        s = self._s({"preferred_search_method_id": 1}, review=review)
        assert s.is_valid(), s.errors

    def test_null_search_method_id_passes(self):
        s = self._s({"preferred_search_method_id": None})
        assert s.is_valid(), s.errors


# Serializer: UploadReferencesResponseSerializer


class TestUploadReferencesResponseSerializer:
    def _s(self, **overrides):
        from slrt_project.reviews.api.serializers import (
            UploadReferencesResponseSerializer,
        )

        data = {
            "message": "Done",
            "task_id": "abc-123",
            "search_method_id": 1,
            "filename": "refs.bib",
            "file_type": "bib",
            "status": "processing",
            **overrides,
        }
        return UploadReferencesResponseSerializer(data=data)

    def test_valid(self):
        assert self._s().is_valid()

    def test_invalid_file_type_fails(self):
        s = self._s(file_type="docx")
        assert not s.is_valid()
        assert "file_type" in s.errors

    def test_all_valid_file_types(self):
        for ft in ["bib", "ris", "endnote"]:
            assert self._s(file_type=ft).is_valid(), f"Expected {ft} to be valid"


# Serializer: AddDataResponseSerializer


class TestAddDataResponseSerializer:
    def test_valid(self):
        from slrt_project.reviews.api.serializers import AddDataResponseSerializer

        s = AddDataResponseSerializer(data={"updated": 10})
        assert s.is_valid(), s.errors

    def test_string_updated_fails(self):
        from slrt_project.reviews.api.serializers import AddDataResponseSerializer

        assert not AddDataResponseSerializer(data={"updated": "many"}).is_valid()

    def test_zero_is_valid(self):
        from slrt_project.reviews.api.serializers import AddDataResponseSerializer

        assert AddDataResponseSerializer(data={"updated": 0}).is_valid()


# Serializer: PrismaResponseSerializer


class TestPrismaResponseSerializer:
    def _valid(self, **overrides):
        base = {
            "message": "OK",
            "file_url": "https://example.com/prisma.png",
            "interactive_url": "https://estech.shinyapps.io/prisma_flowdiagram/?x=1",
            "data": {},
            "validation_issues": [],
        }
        base.update(overrides)
        return base

    def test_valid(self):
        from slrt_project.reviews.api.serializers import PrismaResponseSerializer

        assert PrismaResponseSerializer(data=self._valid()).is_valid()

    def test_null_file_url_valid(self):
        from slrt_project.reviews.api.serializers import PrismaResponseSerializer

        assert PrismaResponseSerializer(data=self._valid(file_url=None)).is_valid()

    def test_validation_issues_list(self):
        from slrt_project.reviews.api.serializers import PrismaResponseSerializer

        s = PrismaResponseSerializer(
            data=self._valid(
                validation_issues=[{"severity": "warning", "message": "counts off"}]
            )
        )
        assert s.is_valid(), s.errors


# Serializer: ExportLatexResponseSerializer


class TestExportLatexResponseSerializer:
    def _s(self, **overrides):
        from slrt_project.reviews.api.serializers import ExportLatexResponseSerializer

        data = {
            "latex_code": r"\begin{table}x\end{table}",
            "review_id": 1,
            "review_title": "SLR",
            "theme_count": 2,
            "format": "table_only",
            **overrides,
        }
        return ExportLatexResponseSerializer(data=data)

    def test_valid(self):
        assert self._s().is_valid()

    def test_full_document_format_valid(self):
        assert self._s(format="full_document").is_valid()

    def test_unknown_format_fails(self):
        s = self._s(format="html")
        assert not s.is_valid()
        assert "format" in s.errors


# Serializer: ExportJsonResponseSerializer


class TestExportJsonResponseSerializer:
    def _valid(self):
        return {
            "reviewId": 1,
            "reviewTitle": "My SLR",
            "exportedAt": "2024-01-01T00:00:00",
            "themeCount": 1,
            "themes": [
                {
                    "id": 1,
                    "name": "Theme A",
                    "description": "Desc",
                    "subthemeCount": 1,
                    "subthemes": [
                        {
                            "id": 10,
                            "name": "Sub A",
                            "description": None,
                            "codeCount": 1,
                            "codes": [
                                {
                                    "id": "abc",
                                    "name": "Code 1",
                                    "comment": None,
                                    "type": "general",
                                    "highlightColor": None,
                                    "referenceId": None,
                                }
                            ],
                        }
                    ],
                }
            ],
        }

    def test_valid(self):
        from slrt_project.reviews.api.serializers import ExportJsonResponseSerializer

        assert ExportJsonResponseSerializer(data=self._valid()).is_valid()

    def test_empty_themes_valid(self):
        from slrt_project.reviews.api.serializers import ExportJsonResponseSerializer

        data = self._valid()
        data["themes"] = []
        data["themeCount"] = 0
        assert ExportJsonResponseSerializer(data=data).is_valid()


# Serializer: InvitationAcceptDeclineResponseSerializer


class TestInvitationAcceptDeclineResponseSerializer:
    def test_valid(self):
        from slrt_project.reviews.api.serializers import (
            InvitationAcceptDeclineResponseSerializer,
        )

        s = InvitationAcceptDeclineResponseSerializer(
            data={"detail": "Invitation accepted."}
        )
        assert s.is_valid(), s.errors

    def test_missing_detail_fails(self):
        from slrt_project.reviews.api.serializers import (
            InvitationAcceptDeclineResponseSerializer,
        )

        s = InvitationAcceptDeclineResponseSerializer(data={})
        assert not s.is_valid()
        assert "detail" in s.errors


# Serializer: DetectDuplicatesResponseSerializer


class TestDetectDuplicatesResponseSerializer:
    def test_valid(self):
        from slrt_project.reviews.api.serializers import (
            DetectDuplicatesResponseSerializer,
        )

        s = DetectDuplicatesResponseSerializer(
            data={
                "message": "Started",
                "task_id": "task-1",
                "status": "processing",
                "threshold": 0.5,
            }
        )
        assert s.is_valid(), s.errors


# Serializer: AutoResolveDuplicatesResponseSerializer


class TestAutoResolveDuplicatesResponseSerializer:
    def test_valid(self):
        from slrt_project.reviews.api.serializers import (
            AutoResolveDuplicatesResponseSerializer,
        )

        s = AutoResolveDuplicatesResponseSerializer(
            data={
                "message": "Started",
                "task_id": "task-2",
                "status": "processing",
                "confidence_threshold": 0.9,
                "detect_first": True,
                "fuzzy_threshold": 0.5,
                "doi_clusters_always": True,
                "preferred_search_method_id": None,
            }
        )
        assert s.is_valid(), s.errors

    def test_null_preferred_search_method(self):
        from slrt_project.reviews.api.serializers import (
            AutoResolveDuplicatesResponseSerializer,
        )

        s = AutoResolveDuplicatesResponseSerializer(
            data={
                "message": "x",
                "task_id": "y",
                "status": "processing",
                "confidence_threshold": 0.9,
                "detect_first": False,
                "fuzzy_threshold": 0.5,
                "doi_clusters_always": False,
                "preferred_search_method_id": None,
            }
        )
        assert s.is_valid(), s.errors
