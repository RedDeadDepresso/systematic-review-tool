from rest_framework import serializers

from slrt_project.integrations.models import ZoteroIntegration, ZoteroSyncLog


class ZoteroIntegrationSerializer(serializers.ModelSerializer):
    """Serializer for ZoteroIntegration (never exposes API key)"""

    is_configured = serializers.BooleanField(read_only=True)

    class Meta:
        model = ZoteroIntegration
        exclude = ["_api_key"]
        read_only_fields = [
            "last_push_at",
            "last_pull_at",
            "last_sync_version",
            "created_at",
            "updated_at",
        ]


class ZoteroConfigSerializer(serializers.Serializer):
    """Serializer for creating/updating Zotero credentials"""

    review = serializers.IntegerField(required=True, write_only=True)
    library_id = serializers.CharField(required=True, write_only=True)
    api_key = serializers.CharField(required=True, write_only=True)
    library_type = serializers.ChoiceField(
        choices=["user", "group"], default="user", required=False
    )
    collection_key = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )
    collection_name = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )

    def validate_library_id(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("Library ID must be numeric")
        return value

    def validate_api_key(self, value):
        if len(value) < 20:
            raise serializers.ValidationError("Invalid API key format")
        return value


class ZoteroSyncLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ZoteroSyncLog
        fields = "__all__"


class ZoteroStatusSerializer(serializers.Serializer):
    """Read-only serializer for Zotero status"""

    is_configured = serializers.BooleanField()
    library_type = serializers.CharField()
    collection_key = serializers.CharField(allow_null=True)
    collection_name = serializers.CharField(allow_null=True)
    last_push = serializers.DateTimeField(allow_null=True)
    last_pull = serializers.DateTimeField(allow_null=True)
    last_sync_version = serializers.IntegerField()
    total_references = serializers.IntegerField()
    synced_references = serializers.IntegerField()
    references_with_pdfs = serializers.IntegerField()
    recent_syncs = ZoteroSyncLogSerializer(many=True)
