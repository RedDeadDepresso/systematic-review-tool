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
  getTaskStatus,
} from '@/api/zotero';
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
        error.response?.data?.error || 'Failed to configure Zotero integration'
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
        error.response?.data?.error || 'Failed to update Zotero integration'
      );
    },
  });
};

export const useDeleteZoteroIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteZoteroIntegration,
    onSuccess: (_, integrationId) => {
      toast.success('Zotero integration removed');
      queryClient.invalidateQueries({
        queryKey: ['zotero-integration'],
      });
      queryClient.removeQueries({
        queryKey: ['zotero-integration', integrationId],
      });
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.error || 'Failed to remove Zotero integration'
      );
    },
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
    }) =>
      setZoteroCollection(
        integrationId,
        params.collectionKey,
        params.collectionName
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
        error.response?.data?.error || 'Failed to update collection filter'
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
      toast.error(error.response?.data?.error || 'Failed to create collection');
    },
  });
};

// ============================================================================
// Sync Operations
// ============================================================================

export const usePushToZotero = (integrationId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (batchSize?: number) => pushToZotero(integrationId, batchSize),
    onSuccess: () => {
      toast.success('Push to Zotero started');
      // Optimistically invalidate status to show task is running
      queryClient.invalidateQueries({
        queryKey: ['zotero-status', integrationId],
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to push to Zotero');
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
      toast.error(error.response?.data?.error || 'Failed to pull from Zotero');
    },
  });
};

// ============================================================================
// Task Status Monitoring
// ============================================================================

export const useTaskStatus = (taskId: string | null) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['task-status', taskId],
    queryFn: () => getTaskStatus(taskId!),
    enabled: !!taskId,
    refetchInterval: (data) => {
      // Stop polling when task is complete
      if (data?.status === 'SUCCESS' || data?.status === 'FAILURE') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
    onSuccess: (data) => {
      // Invalidate status when task completes
      if (data.status === 'SUCCESS') {
        queryClient.invalidateQueries({
          queryKey: ['zotero-status'],
        });
        queryClient.invalidateQueries({
          queryKey: ['zotero-integration'],
        });
        queryClient.invalidateQueries({
          queryKey: ['references'],
        });
      }
    },
  });
};

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
