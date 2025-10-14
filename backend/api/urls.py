from django.urls import path
from api.views import CreateReviewView, RegisterView, RetrieveUserView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


app_name = "api"


urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('auth/user/', RetrieveUserView.as_view(), name='user'),
    path('reviews/', CreateReviewView.as_view(), name='reviews_create'),
]