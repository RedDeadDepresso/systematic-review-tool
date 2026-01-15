from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from api.views import (
    CodeListCreateView,
    CodeRetrieveUpdateDestroyView,
    KeywordListCreateView,
    MainThemeViewSet,
    NoteListCreateView,
    NoteRetrieveUpdateDestroyView,
    ReferenceDuplicatePairCreateView,
    ReferenceDuplicatePairResolveView,
    ReferenceDuplicatePairRetrieveView,
    ReferenceListView,
    ReferenceOpinionUpdateView,
    ReferenceRetrieveUpdateView,
    RegisterView,
    RetrieveUserView,
    ReviewInvitationCreateView,
    ReviewInvitationListView,
    ReviewInvitationUpdateView,
    ReviewListCreateView,
    ReviewRetrieveUpdateDestroyView,
    ReviewUploadReferencesView,
    SubThemeViewSet,
)


app_name = "api"

router = DefaultRouter()
router.register(r"sub-themes", SubThemeViewSet, basename="sub_theme")
router.register(r"main-themes", MainThemeViewSet, basename="main_theme")

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", TokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("auth/user/", RetrieveUserView.as_view(), name="user"),
    path("reviews/", ReviewListCreateView.as_view(), name="reviews"),
    path("reviews/<int:pk>/", ReviewRetrieveUpdateDestroyView.as_view(), name="review"),
    path(
        "reviews/<int:pk>/invites/",
        ReviewInvitationCreateView.as_view(),
        name="review_invites",
    ),
    path(
        "reviews/<int:pk>/references/upload/",
        ReviewUploadReferencesView.as_view(),
        name="upload_references",
    ),
    path(
        "reviews/<int:pk>/references/",
        ReferenceListView.as_view(),
        name="references",
    ),
    path(
        "reviews/<int:review_pk>/references/<int:pk>/",
        ReferenceRetrieveUpdateView.as_view(),
        name="reference",
    ),
    path(
        "reviews/<int:review_pk>/reference-duplicate-pairs/",
        ReferenceDuplicatePairCreateView.as_view(),
        name="reference_duplicate_pairs",
    ),
    path(
        "reviews/<int:review_pk>/reference-duplicate-pairs/retrieve/",
        ReferenceDuplicatePairRetrieveView.as_view(),
        name="reference_duplicate_pairs",
    ),
    path(
        "reviews/<int:review_pk>/reference-duplicate-pairs/<int:pk>/resolve/",
        ReferenceDuplicatePairResolveView.as_view(),
        name="reference_duplicate_pairs_resolve",
    ),
    path(
        "reviews/<int:review_pk>/keywords/",
        KeywordListCreateView.as_view(),
        name="keywords",
    ),
    path(
        "reviews/<int:review_pk>/references/<int:reference_pk>/notes/",
        NoteListCreateView.as_view(),
        name="notes",
    ),
    path(
        "reviews/<int:review_pk>/references/<int:reference_pk>/notes/<int:note_pk>/",
        NoteRetrieveUpdateDestroyView.as_view(),
        name="note",
    ),
    path("invites/", ReviewInvitationListView.as_view(), name="invites"),
    path(
        "invites/<int:pk>/", ReviewInvitationUpdateView.as_view(), name="invite_update"
    ),
    path(
        "reviews/<int:review_pk>/references/<int:reference_pk>/opinions/",
        ReferenceOpinionUpdateView.as_view(),
        name="opinions",
    ),
    path(
        "references/<int:reference_pk>/codes/",
        CodeListCreateView.as_view(),
        name="codes",
    ),
    path(
        "reviews/<int:review_pk>/codes/",
        CodeListCreateView.as_view(),
        name="review_codes",
    ),
    path("codes/<int:pk>/", CodeRetrieveUpdateDestroyView.as_view(), name="code"),
    path("", include(router.urls)),
]
