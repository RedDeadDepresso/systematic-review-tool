from django.urls import include, path
from rest_framework.routers import DefaultRouter

from api.views import (
    CodeViewSet,
    ExtractionAnswerViewSet,
    ExtractionQuestionViewSet,
    ExtractionSectionViewSet,
    ExtractionTableViewSet,
    KeywordViewSet,
    LabelViewSet,
    MainThemeViewSet,
    NoteViewSet,
    ReasonViewSet,
    ReferenceDuplicatePairViewSet,
    ReferenceOpinionViewSet,
    ReferenceViewSet,
    ReviewDataViewSet,
    ReviewInvitationViewSet,
    ReviewMemberRetrieveUpdateDestroyView,
    ReviewViewSet,
    ScreeningCriteriaViewSet,
    ScreeningFullTextViewSet,
    ScreeningViewSet,
    SubThemeViewSet,
    UploadedPDFViewSet,
)


app_name = "api"

router = DefaultRouter()

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
router.register(r"review-data", ReviewDataViewSet, basename="review-data")
router.register(r"screening", ScreeningViewSet, basename="screening")
router.register(
    r"screening-full-text", ScreeningFullTextViewSet, basename="screening-full-text"
)

router.register(
    r"reference-opinions", ReferenceOpinionViewSet, basename="reference-opinions"
)
router.register(r"uploaded-pdfs", UploadedPDFViewSet, basename="uploaded-pdf")

router.register(r"keywords", KeywordViewSet, basename="keyword")
router.register(r"notes", NoteViewSet, basename="note")
router.register(r"reasons", ReasonViewSet, basename="reason")

router.register(r"main-themes", MainThemeViewSet, basename="main-theme")
router.register(r"sub-themes", SubThemeViewSet, basename="sub-theme")
router.register(r"codes", CodeViewSet, basename="code")
router.register(r"labels", LabelViewSet, basename="label")
router.register(
    r"screening-criteria", ScreeningCriteriaViewSet, basename="screening-criteria"
)

router.register(
    r"extraction-sections", ExtractionSectionViewSet, basename="extraction-section"
)
router.register(
    r"extraction-questions", ExtractionQuestionViewSet, basename="extraction-question"
)
router.register(
    r"extraction-answers", ExtractionAnswerViewSet, basename="extraction-answer"
)
router.register(r"extraction", ExtractionTableViewSet, basename="extraction-table")

urlpatterns = [
    path(
        "review-members/<int:pk>/",
        ReviewMemberRetrieveUpdateDestroyView.as_view(),
        name="review-member-detail",
    ),
    path("", include(router.urls)),
]
