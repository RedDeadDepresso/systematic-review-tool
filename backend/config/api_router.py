from django.conf import settings
from django.urls import path
from rest_framework.routers import DefaultRouter, SimpleRouter

from slrt_project.coding.api.views import CodeViewSet, MainThemeViewSet, SubThemeViewSet
from slrt_project.extraction.api.views import (
    BarChartViewSet,
    EvidenceGapMapViewSet,
    ExtractionAnswerViewSet,
    ExtractionFormViewSet,
    ExtractionQuestionViewSet,
    ExtractionSectionViewSet,
    ExtractionTableViewSet,
    PublicationTimelineViewSet,
    ScatterPlotViewSet,
)
from slrt_project.integrations.api.views import ZoteroIntegrationViewSet
from slrt_project.references.api.views import (
    DuplicateClusterViewSet,
    KeywordViewSet,
    LabelViewSet,
    NoteViewSet,
    ReasonViewSet,
    ReferenceOpinionViewSet,
    ReferenceViewSet,
    ReviewDataViewSet,
    ScreeningFullTextViewSet,
    ScreeningViewSet,
    UploadedPDFViewSet,
)
from slrt_project.reviews.api.views import (
    ReviewInvitationViewSet,
    ReviewMemberRetrieveUpdateDestroyView,
    ReviewViewSet,
    ScreeningCriteriaViewSet,
    SearchMethodDestroyView,
)


router = DefaultRouter() if settings.DEBUG else SimpleRouter()


router.register(r"reviews", ReviewViewSet, basename="review")
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
router.register(
    r"duplicate-clusters", DuplicateClusterViewSet, basename="duplicate-clusters"
)

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
router.register(r"extraction-form", ExtractionFormViewSet, basename="extraction-form")
router.register(r"extraction", ExtractionTableViewSet, basename="extraction-table")

router.register(r"charts", BarChartViewSet, basename="charts-bar")
router.register(r"charts", ScatterPlotViewSet, basename="charts-scatter")
router.register(r"charts", EvidenceGapMapViewSet, basename="charts-egm")
router.register(r"charts", PublicationTimelineViewSet, basename="charts-timeline")

router.register(
    r"zotero-integrations", ZoteroIntegrationViewSet, basename="zotero-integrations"
)

urlpatterns = [
    path(
        "review-members/<int:pk>/",
        ReviewMemberRetrieveUpdateDestroyView.as_view(),
        name="review-member-detail",
    ),
    path(
        "search-methods/<int:pk>/",
        SearchMethodDestroyView.as_view(),
        name="search-method-destroy",
    ),
]


app_name = "api"
urlpatterns += router.urls
