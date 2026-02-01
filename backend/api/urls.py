from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from api.views import (
    CodeViewSet,
    KeywordViewSet,
    LabelViewSet,
    MainThemeViewSet,
    NoteViewSet,
    ReferenceDuplicatePairViewSet,
    ReferenceOpinionViewSet,
    ReferenceViewSet,
    ReviewDataView,
    ReviewInvitationViewSet,
    ReviewViewSet,
    ScreeningCriteriaViewSet,
    ScreeningView,
    SubThemeViewSet,
    UploadedPDFViewSet,
    UserViewSet,
)


app_name = "api"

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")

router.register(r"reviews", ReviewViewSet, basename="review")
router.register(
    r"reference-duplicates",
    ReferenceDuplicatePairViewSet,
    basename="reference-duplicates",
)
router.register(
    r"review-invitations", ReviewInvitationViewSet, basename="review-invitation"
)

router.register(r"references", ReferenceViewSet, basename="reference")
router.register(
    r"reference-opinions", ReferenceOpinionViewSet, basename="reference-opinions"
)
router.register(r"uploaded-pdfs", UploadedPDFViewSet, basename="uploaded-pdf")

router.register(r"keywords", KeywordViewSet, basename="keyword")
router.register(r"notes", NoteViewSet, basename="note")

router.register(r"main-themes", MainThemeViewSet, basename="main_theme")
router.register(r"sub-themes", SubThemeViewSet, basename="sub_theme")
router.register(r"codes", CodeViewSet, basename="code")
router.register(r"labels", LabelViewSet, basename="label")
router.register(
    r"screening-criteria", ScreeningCriteriaViewSet, basename="screening-criteria"
)


urlpatterns = [
    path("auth/login/", TokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("review-data/", ReviewDataView.as_view(), name="review-data"),
    path("screening/", ScreeningView.as_view(), name="screening"),
    path("screening-full-text/", ScreeningView.as_view(), name="screening-full-text"),
    path("", include(router.urls)),
]
