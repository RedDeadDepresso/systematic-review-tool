"""
Views for the zotero_integration app.

ViewSet inventory
ZoteroIntegrationViewSet
Full CRUD for ZoteroIntegration, plus the following custom actions:

Standard CRUD
create          — validates via ZoteroConfigSerializer; rejects
duplicate integrations for the same review.
update          — validates via ZoteroUpdateSerializer; enforces the
sync_action guard when the library changes.
destroy         — requires an ``action`` param (keep/unlink/reset) and
``confirm=true`` for destructive actions.

Read actions
status          — returns is_configured, reference counts, last sync
timestamps, and the 10 most recent sync log entries.
collections     — fetches all collections from the Zotero API.
deletion_preview — shows impact of each destroy action before commit.
task_status     — polls Celery task state by task ID.

Write actions
set_collection   — changes (or clears) the collection filter.
create_collection — creates a new collection in Zotero.
push            — enqueues push_references_to_zotero_task (async).
pull            — enqueues pull_references_from_zotero_task (async).
toggle_active   — enables or disables the integration.
"""

import logging

from celery.result import AsyncResult
from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from slrt_project.integrations.api.serializers import (
    ZoteroCollectionsResponseSerializer,
    ZoteroConfigSerializer,
    ZoteroCreateCollectionResponseSerializer,
    ZoteroCreateCollectionSerializer,
    ZoteroDeletionPreviewResponseSerializer,
    ZoteroDestroyResponseSerializer,
    ZoteroIntegrationSerializer,
    ZoteroPullSerializer,
    ZoteroPushSerializer,
    ZoteroSetCollectionResponseSerializer,
    ZoteroSetCollectionSerializer,
    ZoteroStatusResponseSerializer,
    ZoteroSyncLogSerializer,
    ZoteroTaskResponseSerializer,
    ZoteroTaskStatusResponseSerializer,
    ZoteroToggleActiveResponseSerializer,
    ZoteroUpdateResponseSerializer,
    ZoteroUpdateSerializer,
)
from slrt_project.integrations.models import ZoteroIntegration, ZoteroSyncLog
from slrt_project.integrations.services import ZoteroService
from slrt_project.integrations.tasks import (
    pull_references_from_zotero_task,
    push_references_to_zotero_task,
)
from slrt_project.references.models import Reference


logger = logging.getLogger(__name__)


# ZoteroIntegrationViewSet


@extend_schema(tags=["Zotero Integration"])
class ZoteroIntegrationViewSet(viewsets.ModelViewSet):
    """
    Full CRUD + sync management for Zotero integrations.

    Filtering
      ``?review=<pk>``  — optional on list; restricts results to a single review.
    """

    queryset = ZoteroIntegration.objects.all()
    serializer_class = ZoteroIntegrationSerializer
    permission_classes = [IsAuthenticated]

    # ── Standard CRUD ─────────────────────────────────────────────────────

    def get_queryset(self):
        """
        Return all integrations, optionally filtered to a single review.
        """
        queryset = super().get_queryset()
        review_id = self.request.query_params.get("review")
        if review_id:
            queryset = queryset.filter(review_id=review_id)
        return queryset

    @extend_schema(
        summary="Create a Zotero integration",
        request=ZoteroConfigSerializer,
        responses={
            201: ZoteroIntegrationSerializer,
            400: OpenApiResponse(
                description="Validation error or duplicate integration"
            ),
        },
    )
    def create(self, request, *args, **kwargs):
        """
        Create a new Zotero integration for a review.
        """
        serializer = ZoteroConfigSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        review_id = serializer.validated_data["review"]

        # Enforce the one-integration-per-review constraint at the API layer
        # so callers receive a 400 (not a 500 from a DB unique violation).
        if ZoteroIntegration.objects.filter(review_id=review_id).exists():
            return Response(
                {"error": "Zotero integration already exists for this review"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Assigning via integration.api_key (not _api_key) runs the Fernet
        # encryption path before the row is written.
        integration = ZoteroIntegration.objects.create(
            review_id=review_id,
            library_id=serializer.validated_data["library_id"],
            api_key=serializer.validated_data["api_key"],
            library_type=serializer.validated_data.get(
                "library_type", ZoteroIntegration.LibraryType.USER
            ),
            collection_key=serializer.validated_data.get("collection_key"),
            collection_name=serializer.validated_data.get("collection_name"),
            is_active=True,
        )

        return Response(
            ZoteroIntegrationSerializer(integration).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="Update a Zotero integration",
        request=ZoteroUpdateSerializer,
        responses={
            200: ZoteroUpdateResponseSerializer,
            400: OpenApiResponse(
                description="Validation error or missing sync_action when library changes"
            ),
        },
    )
    def update(self, request, *args, **kwargs):
        """
        Partially update an existing integration.
        """
        integration = self.get_object()

        serializer = ZoteroUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        library_id = data.get("library_id")
        api_key = data.get("api_key")
        library_type = data.get("library_type")
        sync_action = data.get("sync_action", "keep")

        # Detect whether the target Zotero library is actually changing so we
        # can enforce the sync_action guard and log accordingly.
        # Wrapped in bool() because `None and expr` short-circuits to None, so
        # `False or None` → None (not False) when library_type is absent.
        library_changing = bool(
            (library_id and library_id != integration.library_id)
            or (library_type and library_type != integration.library_type)
        )

        if library_changing and sync_action in ["reset", "unlink"]:
            count = _reset_sync_data(integration.review, sync_action)
            logger.info("Reset %d references with action '%s'", count, sync_action)

        # Apply credential updates.
        if library_id:
            integration.library_id = library_id
        if api_key:
            # Property setter encrypts before assignment.
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

    @extend_schema(
        summary="Delete a Zotero integration",
        parameters=[
            OpenApiParameter(
                "action",
                str,
                description=(
                    "How to handle synced references: "
                    "'keep' (default) leaves data intact; "
                    "'unlink' removes Zotero keys but keeps PDFs; "
                    "'reset' removes keys and PDFs."
                ),
            ),
            OpenApiParameter(
                "confirm",
                bool,
                description="Must be 'true' for 'unlink' and 'reset' to proceed.",
            ),
        ],
        responses={
            200: ZoteroDestroyResponseSerializer,
            400: OpenApiResponse(description="Invalid action or confirmation required"),
        },
    )
    def destroy(self, request, *args, **kwargs):
        """
        Delete the integration with configurable reference handling.
        """
        integration = self.get_object()
        destroy_action = request.query_params.get("action", "keep")
        confirm = request.query_params.get("confirm", "false").lower() == "true"

        if destroy_action not in ["keep", "unlink", "reset"]:
            return Response(
                {
                    "error": "Invalid action",
                    "valid_actions": ["keep", "unlink", "reset"],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Guard destructive actions behind an explicit confirmation flag.
        if destroy_action in ["unlink", "reset"] and not confirm:
            references_count = Reference.objects.filter(
                review=integration.review, zotero_key__isnull=False
            ).count()
            return Response(
                {
                    "error": "Confirmation required",
                    "message": (
                        f"This action will affect {references_count} synced references."
                    ),
                    "actions": {
                        "keep": "Keep all Zotero data and PDFs (safest)",
                        "unlink": (
                            f"Remove Zotero keys from {references_count} references, keep PDFs"
                        ),
                        "reset": (
                            f"Remove Zotero keys AND PDFs from {references_count} references (destructive)"
                        ),
                    },
                    "confirm": "Add ?confirm=true to proceed",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        affected_count = 0
        if destroy_action != "keep":
            affected_count = _reset_sync_data(integration.review, destroy_action)
            logger.info(
                "Integration %s deleted with action '%s'. Affected %d references.",
                integration.id,
                destroy_action,
                affected_count,
            )

        # Remove all sync history for the review, then the integration itself.
        ZoteroSyncLog.objects.filter(review=integration.review).delete()
        integration.delete()

        return Response(
            {
                "message": "Zotero integration removed successfully",
                "action_performed": destroy_action,
                "references_affected": affected_count,
                "details": {
                    "keep": "All data kept intact",
                    "unlink": f"Unlinked {affected_count} references, kept PDFs",
                    "reset": f"Reset {affected_count} references, removed PDFs",
                }.get(destroy_action),
            }
        )

    # ── Read actions ───────────────────────────────────────────────────────

    @extend_schema(
        summary="Get integration status and sync history",
        responses={200: ZoteroStatusResponseSerializer},
    )
    @action(detail=True, methods=["get"])
    def status(self, request, pk=None):
        """
        Return is_configured, reference counts, sync timestamps, and the
        10 most recent sync log entries for this integration's review.
        """
        integration = self.get_object()

        recent_syncs = ZoteroSyncLog.objects.filter(review=integration.review).order_by(
            "-synced_at"
        )[:10]

        all_refs = Reference.objects.filter(review=integration.review)
        total_refs = all_refs.count()
        synced_refs = all_refs.filter(zotero_key__isnull=False).count()
        with_pdfs = all_refs.exclude(file="").exclude(file__isnull=True).count()

        return Response(
            {
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
        )

    @extend_schema(
        summary="List all collections in the Zotero library",
        responses={
            200: ZoteroCollectionsResponseSerializer,
            400: OpenApiResponse(description="Integration not configured"),
        },
    )
    @action(detail=True, methods=["get"])
    def collections(self, request, pk=None):
        """
        Fetch all collections from the Zotero API for this integration.
        """
        integration = self.get_object()

        if not integration.is_configured:
            return Response(
                {"error": "Zotero integration not properly configured"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        library_id, api_key, library_type = integration.get_credentials()
        zotero = ZoteroService(library_id, api_key, library_type)
        raw_collections = zotero.get_collections()

        return Response(
            {
                "collections": [
                    {
                        "key": col.get("key"),
                        "version": col.get("version"),
                        "name": col.get("data", {}).get("name", "Unnamed"),
                        "parent_collection": col.get("data", {}).get(
                            "parentCollection"
                        ),
                    }
                    for col in raw_collections
                ]
            }
        )

    @extend_schema(
        summary="Preview the impact of deleting this integration",
        responses={200: ZoteroDeletionPreviewResponseSerializer},
    )
    @action(detail=True, methods=["get"])
    def deletion_preview(self, request, pk=None):
        """
        Return a breakdown of how many references and PDFs each destroy
        action would affect, without committing any changes.
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
                "collection": (
                    {
                        "key": integration.collection_key,
                        "name": integration.collection_name,
                    }
                    if integration.collection_key
                    else None
                ),
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

    @extend_schema(
        summary="Poll status of an async push/pull task",
        parameters=[
            OpenApiParameter(
                "task_id",
                str,
                location=OpenApiParameter.PATH,
                description="Celery task ID returned by push or pull.",
            )
        ],
        responses={200: ZoteroTaskStatusResponseSerializer},
    )
    @action(detail=False, methods=["get"], url_path="task-status/(?P<task_id>[^/.]+)")
    def task_status(self, request, task_id=None, pk=None):
        """
        Return the current state of a Celery task.
        """
        task = AsyncResult(task_id)

        response_data: dict = {"task_id": task_id, "status": task.state}

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

    # ── Write actions ──────────────────────────────────────────────────────

    @extend_schema(
        summary="Change (or clear) the collection filter",
        request=ZoteroSetCollectionSerializer,
        responses={
            200: ZoteroSetCollectionResponseSerializer,
            400: OpenApiResponse(description="Validation error"),
        },
    )
    @action(detail=True, methods=["post"])
    def set_collection(self, request, pk=None):
        """
        Update the collection filter for this integration.
        """
        integration = self.get_object()

        serializer = ZoteroSetCollectionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        collection_key = data.get("collection_key")
        collection_name = data.get("collection_name")
        sync_action = data.get("sync_action", "keep")

        collection_changed = integration.collection_key != collection_key

        if collection_changed and sync_action in ["reset", "unlink"]:
            count = _reset_sync_data(integration.review, sync_action)
            logger.info(
                "Collection changed with action '%s'. Affected %d references.",
                sync_action,
                count,
            )

        integration.collection_key = collection_key
        integration.collection_name = collection_name

        if collection_changed:
            integration.last_sync_version = 0
            logger.info("Reset sync version due to collection change.")

        integration.save()

        message = (
            f"Collection filter set to: {collection_name}"
            if collection_key
            else "Collection filter removed. Will sync entire library."
        )
        if collection_changed:
            if sync_action in ["reset", "unlink"]:
                message += f" Sync data {sync_action}."
            message += " Sync version reset — next pull will fetch all items."

        return Response(
            {
                "message": message,
                "collection_key": integration.collection_key,
                "collection_name": integration.collection_name,
                "sync_version_reset": collection_changed,
                "sync_action_performed": sync_action if collection_changed else None,
            }
        )

    @extend_schema(
        summary="Create a new Zotero collection",
        request=ZoteroCreateCollectionSerializer,
        responses={
            200: ZoteroCreateCollectionResponseSerializer,
            400: OpenApiResponse(
                description="Integration not configured or name missing"
            ),
            500: OpenApiResponse(description="Zotero API error"),
        },
    )
    @action(detail=True, methods=["post"])
    def create_collection(self, request, pk=None):
        """
        Create a new collection in the Zotero library.
        """
        integration = self.get_object()

        if not integration.is_configured:
            return Response(
                {"error": "Zotero integration not properly configured"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ZoteroCreateCollectionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        name = data["name"]
        parent_collection = data.get("parent_collection")
        set_as_default = data.get("set_as_default", False)

        library_id, api_key, library_type = integration.get_credentials()
        zotero = ZoteroService(library_id, api_key, library_type)
        result = zotero.create_collection(name, parent_collection)

        if not result:
            return Response(
                {"error": "Failed to create collection"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if set_as_default:
            collection_changed = integration.collection_key != result.get("key")
            integration.collection_key = result.get("key")
            integration.collection_name = name
            if collection_changed:
                integration.last_sync_version = 0
                logger.info(
                    "Collection changed to newly created '%s'. Reset sync version.",
                    name,
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

    @extend_schema(
        summary="Push unpushed references to Zotero (async)",
        request=ZoteroPushSerializer,
        responses={
            202: ZoteroTaskResponseSerializer,
            200: OpenApiResponse(description="No references to push"),
            400: OpenApiResponse(
                description="Integration not configured or large-batch confirmation required"
            ),
        },
    )
    @action(detail=True, methods=["post"])
    def push(self, request, pk=None):
        """
        Enqueue a Celery task that pushes all references without a
        ``zotero_key`` to the Zotero library.
        """
        integration = self.get_object()

        if not integration.is_configured:
            return Response(
                {"error": "Zotero integration not properly configured"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ZoteroPushSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        unpushed_count = Reference.objects.filter(
            review=integration.review, zotero_key__isnull=True
        ).count()

        if unpushed_count == 0:
            return Response({"message": "No references to push", "total_unpushed": 0})

        # ~50 items per batch, ~1 second per batch.
        estimated_batches = ((unpushed_count - 1) // 50) + 1
        estimated_time_minutes = round(unpushed_count / 50)

        # Large-batch guard — prevent accidental very long operations.
        if unpushed_count > 500 and not serializer.validated_data.get("confirm", False):
            return Response(
                {
                    "warning": (
                        f"You are about to push {unpushed_count} references "
                        f"in {estimated_batches} batches."
                    ),
                    "message": 'Add "confirm": true to proceed',
                    "total_unpushed": unpushed_count,
                    "estimated_time_minutes": estimated_time_minutes,
                    "estimated_batches": estimated_batches,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

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

    @extend_schema(
        summary="Pull references from Zotero (async)",
        request=ZoteroPullSerializer,
        responses={
            202: ZoteroTaskResponseSerializer,
            400: OpenApiResponse(description="Integration not configured"),
        },
    )
    @action(detail=True, methods=["post"])
    def pull(self, request, pk=None):
        """
        Enqueue a Celery task that pulls new or updated items from Zotero.
        """
        integration = self.get_object()

        if not integration.is_configured:
            return Response(
                {"error": "Zotero integration not properly configured"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ZoteroPullSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        task = pull_references_from_zotero_task.delay(
            integration.review.id,
            serializer.validated_data.get("force", False),
        )

        return Response(
            {
                "message": "Pull from Zotero started",
                "task_id": task.id,
                "status": "processing",
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @extend_schema(
        summary="Enable or disable the integration",
        responses={200: ZoteroToggleActiveResponseSerializer},
    )
    @action(detail=True, methods=["post"])
    def toggle_active(self, request, pk=None):
        """
        Flip ``is_active`` on the integration.
        """
        integration = self.get_object()
        is_active = request.data.get("is_active", not integration.is_active)

        integration.is_active = is_active
        integration.save()

        return Response(
            {
                "message": (
                    f"Zotero integration {'enabled' if is_active else 'disabled'}"
                ),
                "is_active": integration.is_active,
            }
        )


# Module-level helper
def _reset_sync_data(review, action: str = "reset") -> int:
    """
    Clear Zotero sync metadata from references in *review*.

    Returns
      int
      Number of references affected.
    """
    references = Reference.objects.filter(review=review, zotero_key__isnull=False)
    count = references.count()

    with transaction.atomic():
        if action == "reset":
            # Full reset — strip everything including the uploaded PDF.
            for ref in references:
                ref.zotero_key = None
                ref.zotero_version = 0
                ref.last_synced = None
                ref.file = ""
                ref.save()
        elif action == "unlink":
            # Unlink only — keep PDFs, clear only the Zotero tracking fields.
            references.update(zotero_key=None, zotero_version=0, last_synced=None)

    return count
