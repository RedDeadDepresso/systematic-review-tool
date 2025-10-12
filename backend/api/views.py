from django.shortcuts import render
from api.models import User
from rest_framework import generics
from api.serializers import RegisterSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
