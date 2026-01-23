from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from api.views import (
    CodeViewSet,
    KeywordViewSet,
    MainThemeViewSet,
    NoteViewSet,
    ReferenceDuplicatePairViewSet,
    ReferenceOpinionViewSet,
    ReferenceViewSet,
    ReviewInvitationViewSet,
    ReviewViewSet,
    SubThemeViewSet,
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

router.register(r"keywords", KeywordViewSet, basename="keyword")
router.register(r"notes", NoteViewSet, basename="note")

router.register(r"main-themes", MainThemeViewSet, basename="main_theme")
router.register(r"sub-themes", SubThemeViewSet, basename="sub_theme")
router.register(r"codes", CodeViewSet, basename="code")


urlpatterns = [
    path("auth/login/", TokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("", include(router.urls)),
]
