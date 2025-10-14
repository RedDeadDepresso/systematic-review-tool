from api.models import Review, User
from rest_framework import serializers
from rest_framework.serializers import ModelSerializer
from rest_framework.permissions import AllowAny
from collections import defaultdict


class RegisterSerializer(ModelSerializer):
    email = serializers.EmailField(validators=[])
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'password', "confirm_password"]
        extra_kwargs = {'password': {'write_only': True}}

    def validate(self, data):
        """
        Check that the two password entries match.
        """
        detail = defaultdict(list)
        if User.objects.filter(email=data["email"]).exists():
            detail["Email"].append("A user with this email already exists.")
        if len(data['password']) < 8:
            detail["Password"].append("Password must be at least 8 characters long.")
        if data['password'] != data['confirm_password']:
            detail["Password"].append("Passwords do not match.")
        if detail:
            raise serializers.ValidationError(detail)
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        user = User.objects.create_user(**validated_data)
        return user


class ReviewSerializer(ModelSerializer):
    class Meta:
        model = Review
        fields = ['title', 'description', 'is_archived']