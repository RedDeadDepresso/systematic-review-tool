import { errorMessageString } from '@/lib/error';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getZoteroIntegration,
  createZoteroIntegration,
  updateZoteroIntegration,
  deleteZoteroIntegration,
  getZoteroStatus,
  getZoteroCollections,
  setZoteroCollection,
  createZoteroCollection,
  pushToZotero,
  pullFromZotero,
  getDeletionPreview,
} from '@/features/integrations/api/zotero';
import { toast } from 'sonner';

// ============================================================================
// Integration Management
// ============================================================================

export const useZoteroIntegration = (reviewId: number) => {
  return useQuery({
    queryKey: ['zotero-integration', reviewId],
    queryFn: () => getZoteroIntegration(reviewId),
    enabled: !!reviewId,
  });
};

export const useCreateZoteroIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createZoteroIntegration,
    onSuccess: (data) => {
      toast.success('Zotero integration configured successfully');
      queryClient.invalidateQueries({
        queryKey: ['zotero-integration', data.review],
      });
      queryClient.invalidateQueries({
        queryKey: ['reviews', data.review],
      });
    },
    onError: (error: any) => {
      toast.error(
        `Failed to configure Zotero integration: ${errorMessageString(error)}.`
      );
    },
  });
};

export const useUpdateZoteroIntegration = (integrationId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof updateZoteroIntegration>[1]) =>
      updateZoteroIntegration(integrationId, payload),
    onSuccess: (data) => {
      toast.success('Zotero integration updated successfully');
      queryClient.invalidateQueries({
        queryKey: ['zotero-integration', data.review],
      });
      queryClient.setQueryData(['zotero-integration', integrationId], data);
    },
    onError: (error: any) => {
      toast.error(
        `Failed to update Zotero integration: ${errorMessageString(error)}.`
      );
    },
  });
};

export const useDeleteZoteroIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      integrationId: number;
      action?: 'keep' | 'unlink' | 'reset';
      confirm?: boolean;
    }) =>
      deleteZoteroIntegration(
        params.integrationId,
        params.action,
        params.confirm
      ),
    onSuccess: (_, variables) => {
      toast.success('Zotero integration removed');
      queryClient.invalidateQueries({
        queryKey: ['zotero-integration'],
      });
      queryClient.removeQueries({
        queryKey: ['zotero-integration', variables.integrationId],
      });
    },
    onError: (error: any) => {
      toast.error(
        `Failed to remove Zotero integration: ${errorMessageString(error)}.`
      );
    },
  });
};

export const useDeletionPreview = (integrationId: number | null) => {
  return useQuery({
    queryKey: ['zotero-deletion-preview', integrationId],
    queryFn: () => getDeletionPreview(integrationId!),
    enabled: !!integrationId,
  });
};

// ============================================================================
// Status & Collections
// ============================================================================

export const useZoteroStatus = (integrationId: number | null | undefined) => {
  return useQuery({
    queryKey: ['zotero-status', integrationId],
    queryFn: () => getZoteroStatus(integrationId!),
    enabled: !!integrationId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useZoteroCollections = (
  integrationId: number | null | undefined
) => {
  return useQuery({
    queryKey: ['zotero-collections', integrationId],
    queryFn: () => getZoteroCollections(integrationId!),
    enabled: !!integrationId,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
};

export const useSetZoteroCollection = (integrationId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      collectionKey: string | null;
      collectionName: string | null;
      syncAction?: 'keep' | 'unlink' | 'reset';
    }) =>
      setZoteroCollection(
        integrationId,
        params.collectionKey,
        params.collectionName,
        params.syncAction
      ),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({
        queryKey: ['zotero-integration', integrationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['zotero-status', integrationId],
      });
    },
    onError: (error: any) => {
      toast.error(
        `Failed to update collection filter: ${errorMessageString(error)}.`
      );
    },
  });
};

export const useCreateZoteroCollection = (integrationId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      name: string;
      parentCollection?: string;
      setAsDefault?: boolean;
    }) => createZoteroCollection(integrationId, params),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({
        queryKey: ['zotero-collections', integrationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['zotero-integration', integrationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['zotero-status', integrationId],
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to create collection: ${errorMessageString(error)}.`);
    },
  });
};

// ============================================================================
// Sync Operations
// ============================================================================

export const usePushToZotero = (integrationId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (confirm?: boolean) => pushToZotero(integrationId, confirm),
    onSuccess: (data) => {
      if (data.warning) {
        // Show warning, don't show success toast yet
        return;
      }

      const message =
        data.estimatedBatches && data.estimatedBatches > 1
          ? `Pushing ${data.totalUnpushed} references in ${data.estimatedBatches} batches`
          : `Pushing ${data.totalUnpushed} references to Zotero`;

      toast.success(message);
      queryClient.invalidateQueries({
        queryKey: ['zotero-status', integrationId],
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to push to Zotero: ${errorMessageString(error)}.`);
    },
  });
};

export const usePullFromZotero = (integrationId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (force?: boolean) => pullFromZotero(integrationId, force),
    onSuccess: () => {
      toast.success('Pull from Zotero started');
      // Optimistically invalidate status to show task is running
      queryClient.invalidateQueries({
        queryKey: ['zotero-status', integrationId],
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to pull from Zotero: ${errorMessageString(error)}.`);
    },
  });
};

// ============================================================================
// Task Status Monitoring
// ============================================================================

/**
 * Hook for checking if Zotero is configured for a review
 */
export const useIsZoteroConfigured = (reviewId: number) => {
  const { data: integration, isLoading } = useZoteroIntegration(reviewId);

  return {
    isConfigured: integration?.isConfigured ?? false,
    integrationId: integration?.id,
    isLoading,
  };
};
