from api.models import User
from rest_framework import serializers
from rest_framework.serializers import ModelSerializer
from rest_framework.permissions import AllowAny


class RegisterSerializer(ModelSerializer):
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'password', "confirm_password"]
        extra_kwargs = {'password': {'write_only': True}}

    def validate(self, data):
        """
        Check that the two password entries match.
        """
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        user = User.objects.create_user(**validated_data)
        return user
