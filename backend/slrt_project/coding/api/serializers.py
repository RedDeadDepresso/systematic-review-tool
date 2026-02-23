from rest_framework import serializers

from slrt_project.coding.models import Code, MainTheme, SubTheme


class CodeSerializer(serializers.ModelSerializer):
    reference_file_url = serializers.SerializerMethodField()
    reference_title = serializers.SerializerMethodField()

    class Meta:
        model = Code
        fields = "__all__"
        read_only_fields = ["id", "member"]

    def get_reference_title(self, obj):
        if obj.reference and obj.reference.title:
            return obj.reference.title
        return None

    def get_reference_file_url(self, obj):
        request = self.context.get("request")

        if obj.reference and obj.reference.file:
            url = obj.reference.file.url
            return request.build_absolute_uri(url) if request else url

        return None


class SubThemeSerializer(serializers.ModelSerializer):
    code_ids = serializers.PrimaryKeyRelatedField(
        many=True, read_only=True, source="codes"
    )

    class Meta:
        model = SubTheme
        fields = ["id", "review", "name", "description", "code_ids", "main_theme"]
        read_only_fields = ["id", "code_ids"]


class MainThemeSerializer(serializers.ModelSerializer):
    sub_theme_ids = serializers.PrimaryKeyRelatedField(
        many=True, read_only=True, source="sub_themes"
    )

    class Meta:
        model = MainTheme
        fields = ["id", "review", "name", "description", "sub_theme_ids"]
        read_only_fields = ["id", "sub_theme_ids"]
