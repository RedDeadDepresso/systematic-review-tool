from rest_framework import serializers

from slrt_project.users.models import User


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "avatar", "display_name"]
        read_only_fields = ["id"]

    def get_display_name(self, obj):
        return str(obj)

    def update(self, instance, validated_data):
        from allauth.account.models import EmailAddress

        if self.initial_data.get("avatar") == "":
            instance.avatar = None

        previous_email = instance.email

        updated_instance = super().update(instance, validated_data)

        if previous_email != updated_instance.email:
            EmailAddress.objects.filter(
                user=updated_instance, email=previous_email
            ).delete()
            EmailAddress.objects.get_or_create(
                user=updated_instance, email=updated_instance.email
            )

        return updated_instance
