from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from api.views import (
    ReferenceDuplicatePairCreateView,
    ReferenceDuplicatePairResolveView,
    ReferenceDuplicatePairRetrieveView,
    ReferenceListView,
    ReferenceRetrieveView,
    RegisterView,
    RetrieveUserView,
    ReviewListCreateView,
    ReviewRetrieveUpdateDestroyView,
    ReviewUploadReferencesView,
)


app_name = "api"


urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", TokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("auth/user/", RetrieveUserView.as_view(), name="user"),
    path("reviews/", ReviewListCreateView.as_view(), name="reviews"),
    path("reviews/<int:pk>/", ReviewRetrieveUpdateDestroyView.as_view(), name="review"),
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
        ReferenceRetrieveView.as_view(),
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
]
