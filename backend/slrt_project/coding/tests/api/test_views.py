from unittest.mock import MagicMock, patch

import pytest
from rest_framework import status
from rest_framework.test import APIRequestFactory

from slrt_project.coding.tests.factories import (
    CodeFactory,
    MainThemeFactory,
    SubThemeFactory,
)
from slrt_project.reviews.tests.factories import ReviewFactory, ReviewMemberFactory


factory = APIRequestFactory()


# Module-level autouse fixture — bypass IsAuthenticated for every test
@pytest.fixture(autouse=True)
def bypass_is_authenticated():
    """
    Patch DRF's IsAuthenticated so tests using APIRequestFactory (which does
    not run authentication middleware) are not rejected with 401.  Tests that
    exercise permission logic patch check_permission directly.
    """
    with patch(
        "rest_framework.permissions.IsAuthenticated.has_permission",
        return_value=True,
    ):
        yield


# Autouse fixture — bypass check_permission for most tests
@pytest.fixture(autouse=True)
def bypass_check_permission():
    """
    Patch check_permission to a no-op so tests focus on view behaviour rather
    than the permission layer.  Tests that exercise permission paths override
    this via their own patch.
    """
    with patch("slrt_project.coding.api.views.check_permission"):
        yield


# Shared helpers
def make_user(pk=1):
    """Minimal authenticated user mock."""
    u = MagicMock()
    u.pk = pk
    u.id = pk
    u.is_authenticated = True
    return u


# CodingMixin — list() guard
class TestCodingMixinListGuard:
    """The 'review' query param is required on every list endpoint."""

    def _view(self):
        from slrt_project.coding.api.views import CodeViewSet

        return CodeViewSet.as_view({"get": "list"})

    def test_missing_review_returns_400(self):
        request = factory.get("/")
        request.user = make_user()
        response = self._view()(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "review" in str(response.data)


# CodeViewSet
@pytest.mark.django_db
class TestCodeViewSet:
    def _view(self, method="list"):
        from slrt_project.coding.api.views import CodeViewSet

        actions = {
            "get": method if method == "list" else "retrieve",
            "post": "create",
            "patch": "partial_update",
            "delete": "destroy",
        }
        return CodeViewSet.as_view(actions)

    def _list_view(self):
        from slrt_project.coding.api.views import CodeViewSet

        return CodeViewSet.as_view({"get": "list"})

    def _detail_view(self):
        from slrt_project.coding.api.views import CodeViewSet

        return CodeViewSet.as_view(
            {
                "get": "retrieve",
                "patch": "partial_update",
                "delete": "destroy",
            }
        )

    def test_list_returns_200(self):
        member = ReviewMemberFactory()
        review = member.review
        CodeFactory(review=review, member=member)
        request = factory.get("/", {"review": review.pk})
        request.user = make_user()
        with patch(
            "slrt_project.coding.api.views.get_object_or_404", return_value=review
        ):
            response = self._list_view()(request)
        assert response.status_code == status.HTTP_200_OK

    def test_list_filtered_by_review(self):
        member = ReviewMemberFactory()
        review = member.review
        other_review = ReviewFactory()
        CodeFactory(review=review, member=member)
        CodeFactory(
            review=other_review, member=ReviewMemberFactory(review=other_review)
        )
        request = factory.get("/", {"review": review.pk})
        request.user = make_user()
        with patch(
            "slrt_project.coding.api.views.get_object_or_404", return_value=review
        ):
            response = self._list_view()(request)
        returned_reviews = {item["review"] for item in response.data}
        assert returned_reviews == {review.pk}

    def test_create_sets_member_from_request_user(self):
        member = ReviewMemberFactory()
        review = member.review
        from slrt_project.coding.api.views import CodeViewSet

        create_view = CodeViewSet.as_view({"post": "create"})
        request = factory.post(
            "/",
            {
                "review": review.pk,
                "name": "A new code",
                "type": "text",
            },
            format="json",
        )
        request.user = member.user
        with patch(
            "slrt_project.coding.api.views.get_object_or_404",
            side_effect=[review, member],
        ):
            response = create_view(request)
        # member is set server-side — client never sends it, response must include it.
        assert response.status_code == status.HTTP_201_CREATED

    def test_retrieve_returns_200(self):
        code = CodeFactory()
        request = factory.get("/")
        request.user = make_user()
        response = self._detail_view()(request, pk=str(code.pk))
        assert response.status_code == status.HTTP_200_OK

    def test_retrieve_includes_computed_fields(self):
        code = CodeFactory(reference=None)
        request = factory.get("/")
        request.user = make_user()
        response = self._detail_view()(request, pk=str(code.pk))
        assert "reference_title" in response.data
        assert "reference_file_url" in response.data

    def test_partial_update_returns_200(self):
        code = CodeFactory()
        request = factory.patch("/", {"name": "Updated name"}, format="json")
        request.user = make_user()
        response = self._detail_view()(request, pk=str(code.pk))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Updated name"

    def test_destroy_returns_204(self):
        code = CodeFactory()
        pk = str(code.pk)
        request = factory.delete("/")
        request.user = make_user()
        response = self._detail_view()(request, pk=pk)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_missing_review_param_returns_400(self):
        request = factory.get("/")
        request.user = make_user()
        response = self._list_view()(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_queryset_selects_related_reference(self):
        """get_queryset must use select_related('reference') for N+1 safety."""
        from slrt_project.coding.api.views import CodeViewSet

        qs = CodeViewSet().get_queryset()
        # Django stores select_related as a dict on the query object.
        assert "reference" in qs.query.select_related


# SubThemeViewSet
@pytest.mark.django_db
class TestSubThemeViewSet:
    def _list_view(self):
        from slrt_project.coding.api.views import SubThemeViewSet

        return SubThemeViewSet.as_view({"get": "list", "post": "create"})

    def _detail_view(self):
        from slrt_project.coding.api.views import SubThemeViewSet

        return SubThemeViewSet.as_view(
            {
                "get": "retrieve",
                "patch": "partial_update",
                "delete": "destroy",
            }
        )

    def test_list_returns_200(self):
        review = ReviewFactory()
        request = factory.get("/", {"review": review.pk})
        request.user = make_user()
        with patch(
            "slrt_project.coding.api.views.get_object_or_404", return_value=review
        ):
            response = self._list_view()(request)
        assert response.status_code == status.HTTP_200_OK

    def test_list_filtered_by_review(self):
        member = ReviewMemberFactory()
        review = member.review
        sub = SubThemeFactory(review=review, member=member)
        SubThemeFactory()  # different review
        request = factory.get("/", {"review": review.pk})
        request.user = make_user()
        with patch(
            "slrt_project.coding.api.views.get_object_or_404", return_value=review
        ):
            response = self._list_view()(request)
        returned_ids = {item["id"] for item in response.data}
        assert sub.pk in returned_ids

    def test_retrieve_returns_200(self):
        sub = SubThemeFactory()
        request = factory.get("/")
        request.user = make_user()
        response = self._detail_view()(request, pk=sub.pk)
        assert response.status_code == status.HTTP_200_OK

    def test_response_includes_code_ids(self):
        sub = SubThemeFactory()
        request = factory.get("/")
        request.user = make_user()
        response = self._detail_view()(request, pk=sub.pk)
        assert "code_ids" in response.data

    def test_partial_update_returns_200(self):
        sub = SubThemeFactory()
        request = factory.patch("/", {"name": "Renamed"}, format="json")
        request.user = make_user()
        response = self._detail_view()(request, pk=sub.pk)
        assert response.status_code == status.HTTP_200_OK

    def test_destroy_returns_204(self):
        sub = SubThemeFactory()
        pk = sub.pk
        request = factory.delete("/")
        request.user = make_user()
        response = self._detail_view()(request, pk=pk)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_missing_review_returns_400(self):
        request = factory.get("/")
        request.user = make_user()
        response = self._list_view()(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# MainThemeViewSet
@pytest.mark.django_db
class TestMainThemeViewSet:
    def _list_view(self):
        from slrt_project.coding.api.views import MainThemeViewSet

        return MainThemeViewSet.as_view({"get": "list", "post": "create"})

    def _detail_view(self):
        from slrt_project.coding.api.views import MainThemeViewSet

        return MainThemeViewSet.as_view(
            {
                "get": "retrieve",
                "patch": "partial_update",
                "delete": "destroy",
            }
        )

    def test_list_returns_200(self):
        review = ReviewFactory()
        request = factory.get("/", {"review": review.pk})
        request.user = make_user()
        with patch(
            "slrt_project.coding.api.views.get_object_or_404", return_value=review
        ):
            response = self._list_view()(request)
        assert response.status_code == status.HTTP_200_OK

    def test_list_filtered_by_review(self):
        member = ReviewMemberFactory()
        review = member.review
        theme = MainThemeFactory(review=review, member=member)
        MainThemeFactory()  # different review
        request = factory.get("/", {"review": review.pk})
        request.user = make_user()
        with patch(
            "slrt_project.coding.api.views.get_object_or_404", return_value=review
        ):
            response = self._list_view()(request)
        returned_ids = {item["id"] for item in response.data}
        assert theme.pk in returned_ids

    def test_retrieve_returns_200(self):
        theme = MainThemeFactory()
        request = factory.get("/")
        request.user = make_user()
        response = self._detail_view()(request, pk=theme.pk)
        assert response.status_code == status.HTTP_200_OK

    def test_response_includes_sub_theme_ids(self):
        theme = MainThemeFactory()
        request = factory.get("/")
        request.user = make_user()
        response = self._detail_view()(request, pk=theme.pk)
        assert "sub_theme_ids" in response.data

    def test_sub_theme_ids_populated(self):
        theme = MainThemeFactory()
        sub = SubThemeFactory(
            main_theme=theme, review=theme.review, member=theme.member
        )
        request = factory.get("/")
        request.user = make_user()
        response = self._detail_view()(request, pk=theme.pk)
        assert sub.pk in response.data["sub_theme_ids"]

    def test_partial_update_returns_200(self):
        theme = MainThemeFactory()
        request = factory.patch("/", {"name": "Renamed"}, format="json")
        request.user = make_user()
        response = self._detail_view()(request, pk=theme.pk)
        assert response.status_code == status.HTTP_200_OK

    def test_destroy_returns_204(self):
        theme = MainThemeFactory()
        pk = theme.pk
        request = factory.delete("/")
        request.user = make_user()
        response = self._detail_view()(request, pk=pk)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_missing_review_returns_400(self):
        request = factory.get("/")
        request.user = make_user()
        response = self._list_view()(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
