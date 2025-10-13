from django.db import IntegrityError
from django.shortcuts import render
from api.models import User
from rest_framework import generics, status
from api.serializers import RegisterSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer