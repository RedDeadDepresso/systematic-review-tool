import logging

from celery.result import AsyncResult
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from slrt_project.integrations.api.serializers import (
    ZoteroConfigSerializer,
    ZoteroIntegrationSerializer,
    ZoteroSyncLogSerializer,
)
from slrt_project.integrations.models import ZoteroIntegration, ZoteroSyncLog
from slrt_project.integrations.services import ZoteroService
from slrt_project.integrations.tasks import (
    pull_references_from_zotero_task,
    push_references_to_zotero_task,
)
from slrt_project.references.models import Reference


logger = logging.getLogger(__name__)


class ZoteroIntegrationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Zotero integrations
    """

    queryset = ZoteroIntegration.objects.all()
    serializer_class = ZoteroIntegrationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter integrations by review if provided"""
        queryset = super().get_queryset()
        review_id = self.request.query_params.get("review")
        if review_id:
            queryset = queryset.filter(review_id=review_id)
        return queryset

    def create(self, request, *args, **kwargs):
        """
        Create a new Zotero integration
        """
        serializer = ZoteroConfigSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        review_id = serializer.validated_data["review"]

        # Check if integration already exists
        if ZoteroIntegration.objects.filter(review_id=review_id).exists():
            return Response(
                {"error": "Zotero integration already exists for this review"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create integration
        integration = ZoteroIntegration.objects.create(
            review_id=review_id,
            library_id=serializer.validated_data["library_id"],
            api_key=serializer.validated_data["api_key"],
            library_type=serializer.validated_data.get("library_type", "user"),
            collection_key=serializer.validated_data.get("collection_key"),
            collection_name=serializer.validated_data.get("collection_name"),
            is_active=True,
        )

        return Response(
            ZoteroIntegrationSerializer(integration).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        """Update Zotero integration"""
        integration = self.get_object()

        library_id = request.data.get("library_id")
        api_key = request.data.get("api_key")
        library_type = request.data.get("library_type")
        sync_action = request.data.get("sync_action", "keep")

        # Check if library is changing
        library_changing = (library_id and library_id != integration.library_id) or (
            library_type and library_type != integration.library_type
        )

        if library_changing:
            # Library change detected - require explicit action
            if sync_action not in ["reset", "unlink", "keep"]:
                return Response(
                    {
                        "error": "Library configuration is changing",
                        "message": (
                            'You must specify sync_action: "reset" (clear all data), '
                            '"unlink" (keep PDFs, clear keys), or "keep" (no changes)'
                        ),
                        "current_library_id": integration.library_id,
                        "new_library_id": library_id,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if sync_action in ["reset", "unlink"]:
                count = self._reset_sync_data(integration.review, sync_action)
                logger.info(f"Reset {count} references with action '{sync_action}'")

        # Update fields
        if library_id:
            integration.library_id = library_id
        if api_key:
            integration.api_key = api_key
        if library_type:
            integration.library_type = library_type

        integration.save()

        return Response(
            {
                "message": "Integration updated successfully",
                "library_changed": library_changing,
                "sync_action_performed": sync_action if library_changing else None,
                "data": ZoteroIntegrationSerializer(integration).data,
            }
        )

    def destroy(self, request, *args, **kwargs):
        """
        Delete Zotero integration with configurable reference handling
        """
        integration = self.get_object()
        action = request.query_params.get("action", "keep")
        confirm = request.query_params.get("confirm", "false").lower() == "true"

        # Validate action
        if action not in ["keep", "unlink", "reset"]:
            return Response(
                {
                    "error": "Invalid action",
                    "valid_actions": ["keep", "unlink", "reset"],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Require confirmation for destructive actions
        if action in ["unlink", "reset"] and not confirm:
            references_count = Reference.objects.filter(
                review=integration.review, zotero_key__isnull=False
            ).count()

            return Response(
                {
                    "error": "Confirmation required",
                    "message": f"This action will affect {references_count} synced references.",
                    "actions": {
                        "keep": "Keep all Zotero data and PDFs (safest)",
                        "unlink": f"Remove Zotero keys from {references_count} references, keep PDFs",
                        "reset": f"Remove Zotero keys AND PDFs from {references_count} references (destructive)",
                    },
                    "confirm": "Add ?confirm=true to proceed",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Perform action on references
        affected_count = 0
        if action != "keep":
            affected_count = self._reset_sync_data(integration.review, action)
            logger.info(
                f"Integration {integration.id} deleted with action '{action}'. "
                f"Affected {affected_count} references."
            )

        # Delete sync logs
        ZoteroSyncLog.objects.filter(review=integration.review).delete()

        # Delete integration
        integration.delete()

        return Response(
            {
                "message": "Zotero integration removed successfully",
                "action_performed": action,
                "references_affected": affected_count,
                "details": {
                    "keep": "All data kept intact",
                    "unlink": f"Unlinked {affected_count} references, kept PDFs",
                    "reset": f"Reset {affected_count} references, removed PDFs",
                }.get(action),
            }
        )

    @action(detail=True, methods=["get"])
    def deletion_preview(self, request, pk=None):
        """
        Preview what will happen when deleting this integration
        """
        integration = self.get_object()

        synced_refs = Reference.objects.filter(
            review=integration.review, zotero_key__isnull=False
        )

        synced_count = synced_refs.count()
        refs_with_pdfs = synced_refs.exclude(file="").exclude(file__isnull=True).count()

        return Response(
            {
                "integration_id": integration.id,
                "review_id": integration.review.id,
                "synced_references": synced_count,
                "references_with_pdfs": refs_with_pdfs,
                "collection": {
                    "key": integration.collection_key,
                    "name": integration.collection_name,
                }
                if integration.collection_key
                else None,
                "actions": {
                    "keep": {
                        "description": "Keep all Zotero data and PDFs (safest)",
                        "affected_references": 0,
                        "pdfs_lost": 0,
                    },
                    "unlink": {
                        "description": "Remove Zotero keys but keep PDFs",
                        "affected_references": synced_count,
                        "pdfs_lost": 0,
                    },
                    "reset": {
                        "description": "Remove Zotero keys AND PDFs (destructive)",
                        "affected_references": synced_count,
                        "pdfs_lost": refs_with_pdfs,
                    },
                },
            }
        )

    @action(detail=True, methods=["get"])
    def status(self, request, pk=None):
        """
        Get integration status and sync history
        """
        integration = self.get_object()

        # Get recent syncs
        recent_syncs = ZoteroSyncLog.objects.filter(review=integration.review).order_by(
            "-synced_at"
        )[:10]

        # Get reference counts
        total_refs = Reference.objects.filter(review=integration.review).count()
        synced_refs = Reference.objects.filter(
            review=integration.review, zotero_key__isnull=False
        ).count()

        all_refs = Reference.objects.filter(review=integration.review)
        with_pdfs = all_refs.exclude(file="").exclude(file__isnull=True).count()

        status_data = {
            "is_configured": integration.is_configured,
            "library_type": integration.library_type,
            "collection_key": integration.collection_key,
            "collection_name": integration.collection_name,
            "last_push": integration.last_push_at,
            "last_pull": integration.last_pull_at,
            "last_sync_version": integration.last_sync_version,
            "total_references": total_refs,
            "synced_references": synced_refs,
            "references_with_pdfs": with_pdfs,
            "recent_syncs": ZoteroSyncLogSerializer(recent_syncs, many=True).data,
        }

        return Response(status_data)

    @action(detail=True, methods=["get"])
    def collections(self, request, pk=None):
        """
        Get all collections from Zotero library
        """
        integration = self.get_object()

        if not integration.is_configured:
            return Response(
                {"error": "Zotero integration not properly configured"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        library_id, api_key, library_type = integration.get_credentials()
        zotero = ZoteroService(library_id, api_key, library_type)

        collections = zotero.get_collections()

        # Format collections
        formatted_collections = []
        for col in collections:
            formatted_collections.append(
                {
                    "key": col.get("key"),
                    "version": col.get("version"),
                    "name": col.get("data", {}).get("name", "Unnamed"),
                    "parent_collection": col.get("data", {}).get("parentCollection"),
                }
            )

        return Response({"collections": formatted_collections})

    @action(detail=True, methods=["post"])
    def set_collection(self, request, pk=None):
        """Set which collection to sync from with optional sync action"""
        integration = self.get_object()

        collection_key = request.data.get("collection_key")
        collection_name = request.data.get("collection_name")
        sync_action = request.data.get("sync_action", "keep")

        # Check if collection is actually changing
        collection_changed = integration.collection_key != collection_key

        # Perform sync action if collection changed and action specified
        if collection_changed and sync_action in ["reset", "unlink"]:
            count = self._reset_sync_data(integration.review, sync_action)
            logger.info(
                f"Collection changed with action '{sync_action}'. "
                f"Affected {count} references."
            )

        # Update collection
        integration.collection_key = collection_key
        integration.collection_name = collection_name

        # Reset sync version on collection change
        if collection_changed:
            integration.last_sync_version = 0
            logger.info("Reset sync version due to collection change")

        integration.save()

        message = (
            f"Collection filter set to: {collection_name}"
            if collection_key
            else "Collection filter removed. Will sync entire library."
        )

        if collection_changed:
            if sync_action in ["reset", "unlink"]:
                message += f" Sync data {sync_action}."
            message += " Sync version reset - next pull will fetch all items."

        return Response(
            {
                "message": message,
                "collection_key": integration.collection_key,
                "collection_name": integration.collection_name,
                "sync_version_reset": collection_changed,
                "sync_action_performed": sync_action if collection_changed else None,
            }
        )

    def _reset_sync_data(self, review, action="reset"):
        """Reset Zotero sync data"""
        from django.db import transaction

        references = Reference.objects.filter(review=review, zotero_key__isnull=False)

        count = references.count()

        with transaction.atomic():
            if action == "reset":
                # Clear everything
                for ref in references:
                    ref.zotero_key = None
                    ref.zotero_version = 0
                    ref.last_synced = None
                    ref.file = ""  # Clear file
                    ref.save()

            elif action == "unlink":
                # Keep PDFs, clear Zotero metadata
                references.update(zotero_key=None, zotero_version=0, last_synced=None)

        return count

    @action(detail=True, methods=["post"])
    def create_collection(self, request, pk=None):
        """
        Create a new collection in Zotero
        """
        integration = self.get_object()

        if not integration.is_configured:
            return Response(
                {"error": "Zotero integration not properly configured"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        name = request.data.get("name")
        parent_collection = request.data.get("parent_collection")
        set_as_default = request.data.get("set_as_default", False)

        if not name:
            return Response(
                {"error": "Collection name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        library_id, api_key, library_type = integration.get_credentials()
        zotero = ZoteroService(library_id, api_key, library_type)

        result = zotero.create_collection(name, parent_collection)

        if result:
            # Set as default collection if requested
            if set_as_default:
                # Check if collection is changing
                collection_changed = integration.collection_key != result.get("key")

                integration.collection_key = result.get("key")
                integration.collection_name = name

                # Reset sync version on collection change
                if collection_changed:
                    integration.last_sync_version = 0
                    logger.info(
                        f"Collection changed to newly created '{name}'. Reset sync version."
                    )

                integration.save()

            return Response(
                {
                    "message": "Collection created successfully",
                    "collection": {
                        "key": result.get("key"),
                        "name": name,
                        "version": result.get("version"),
                    },
                    "set_as_default": set_as_default,
                    "sync_version_reset": set_as_default,
                }
            )
        else:
            return Response(
                {"error": "Failed to create collection"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def push(self, request, pk=None):
        """Push all unpushed references to Zotero (async task)"""
        integration = self.get_object()

        if not integration.is_configured:
            return Response(
                {"error": "Zotero integration not properly configured"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get count of references to push
        unpushed_count = Reference.objects.filter(
            review=integration.review, zotero_key__isnull=True
        ).count()

        if unpushed_count == 0:
            return Response({"message": "No references to push", "total_unpushed": 0})

        # Calculate estimates based on 50 items per batch
        estimated_batches = ((unpushed_count - 1) // 50) + 1
        # ~1 second per batch = ~50 items per minute
        estimated_time_minutes = round(unpushed_count / 50)

        # Warn for very large batches
        if unpushed_count > 500:
            confirm = request.data.get("confirm", False)
            if not confirm:
                return Response(
                    {
                        "warning": f"You are about to push {unpushed_count} references in {estimated_batches} batches.",
                        "message": 'Add "confirm": true to proceed',
                        "total_unpushed": unpushed_count,
                        "estimated_time_minutes": estimated_time_minutes,
                        "estimated_batches": estimated_batches,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Start async task
        task = push_references_to_zotero_task.delay(integration.review.id)

        return Response(
            {
                "message": f"Pushing {unpushed_count} references to Zotero",
                "task_id": task.id,
                "status": "processing",
                "total_unpushed": unpushed_count,
                "estimated_batches": estimated_batches,
                "estimated_time_minutes": estimated_time_minutes,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["post"])
    def pull(self, request, pk=None):
        """
        Pull references from Zotero (async task)
        """
        integration = self.get_object()

        if not integration.is_configured:
            return Response(
                {"error": "Zotero integration not properly configured"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        force = request.data.get("force", False)

        # Start async task
        task = pull_references_from_zotero_task.delay(integration.review.id, force)

        return Response(
            {
                "message": "Pull from Zotero started",
                "task_id": task.id,
                "status": "processing",
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=False, methods=["get"], url_path="task-status/(?P<task_id>[^/.]+)")
    def task_status(self, request, task_id=None, pk=None):
        """
        Check status of an async task
        """
        task = AsyncResult(task_id)

        response_data = {
            "task_id": task_id,
            "status": task.state,
        }

        if task.state == "PENDING":
            response_data["message"] = "Task is waiting to be processed"
        elif task.state == "STARTED":
            response_data["message"] = "Task is processing"
        elif task.state == "SUCCESS":
            response_data["result"] = task.result
            response_data["message"] = "Task completed successfully"
        elif task.state == "FAILURE":
            response_data["error"] = str(task.info)
            response_data["message"] = "Task failed"
        elif task.state == "RETRY":
            response_data["message"] = "Task is retrying after failure"

        return Response(response_data)

    @action(detail=True, methods=["post"])
    def toggle_active(self, request, pk=None):
        """
        Enable/disable Zotero integration
        """
        integration = self.get_object()
        is_active = request.data.get("is_active", not integration.is_active)

        integration.is_active = is_active
        integration.save()

        return Response(
            {
                "message": f"Zotero integration {'enabled' if is_active else 'disabled'}",
                "is_active": integration.is_active,
            }
        )
