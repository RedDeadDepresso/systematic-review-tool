import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { onMutationError } from '@/lib/query-helpers';
import { reviewKeys } from '@/features/reviews/hooks/use-reviews';

export const zoteroKeys = {
  integration: (reviewId: number) => ['zotero-integration', reviewId] as const,
  integrationById: (integrationId: number) =>
    ['zotero-integration', integrationId] as const,
  allIntegrations: ['zotero-integration'] as const,
  status: (integrationId: number | null | undefined) =>
    ['zotero-status', integrationId] as const,
  collections: (integrationId: number | null | undefined) =>
    ['zotero-collections', integrationId] as const,
  deletionPreview: (integrationId: number | null) =>
    ['zotero-deletion-preview', integrationId] as const,
};

// ─── Integration management ────────────────────────────────────────────────────

export const useZoteroIntegration = (reviewId: number) =>
  useQuery({
    queryKey: zoteroKeys.integration(reviewId),
    queryFn: () => getZoteroIntegration(reviewId),
    enabled: !!reviewId,
  });

export const useCreateZoteroIntegration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createZoteroIntegration,
    onSuccess: (data) => {
      toast.success('Zotero integration configured successfully');
      queryClient.invalidateQueries({
        queryKey: zoteroKeys.integration(data.review),
      });
      queryClient.invalidateQueries({
        queryKey: reviewKeys.detail(data.review),
      });
    },
    onError: onMutationError('configure Zotero integration'),
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
        queryKey: zoteroKeys.integration(data.review),
      });
      queryClient.setQueryData(zoteroKeys.integrationById(integrationId), data);
    },
    onError: onMutationError('update Zotero integration'),
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
      queryClient.invalidateQueries({ queryKey: zoteroKeys.allIntegrations });
      queryClient.removeQueries({
        queryKey: zoteroKeys.integrationById(variables.integrationId),
      });
    },
    onError: onMutationError('remove Zotero integration'),
  });
};

export const useDeletionPreview = (integrationId: number | null) =>
  useQuery({
    queryKey: zoteroKeys.deletionPreview(integrationId),
    queryFn: () => getDeletionPreview(integrationId!),
    enabled: !!integrationId,
  });

// ─── Status & Collections ──────────────────────────────────────────────────────

export const useZoteroStatus = (integrationId: number | null | undefined) =>
  useQuery({
    queryKey: zoteroKeys.status(integrationId),
    queryFn: () => getZoteroStatus(integrationId!),
    enabled: !!integrationId,
    refetchInterval: 30_000,
  });

export const useZoteroCollections = (
  integrationId: number | null | undefined
) =>
  useQuery({
    queryKey: zoteroKeys.collections(integrationId),
    queryFn: () => getZoteroCollections(integrationId!),
    enabled: !!integrationId,
    staleTime: 5 * 60 * 1000,
  });

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
        queryKey: zoteroKeys.integration(integrationId),
      });
      queryClient.invalidateQueries({
        queryKey: zoteroKeys.status(integrationId),
      });
    },
    onError: onMutationError('update collection filter'),
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
        queryKey: zoteroKeys.collections(integrationId),
      });
      queryClient.invalidateQueries({
        queryKey: zoteroKeys.integration(integrationId),
      });
      queryClient.invalidateQueries({
        queryKey: zoteroKeys.status(integrationId),
      });
    },
    onError: onMutationError('create collection'),
  });
};

// ─── Sync operations ──────────────────────────────────────────────────────────

export const usePushToZotero = (integrationId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirm?: boolean) => pushToZotero(integrationId, confirm),
    onSuccess: (data) => {
      if (data.warning) return;
      const message =
        data.estimatedBatches && data.estimatedBatches > 1
          ? `Pushing ${data.totalUnpushed} references in ${data.estimatedBatches} batches`
          : `Pushing ${data.totalUnpushed} references to Zotero`;
      toast.success(message);
      queryClient.invalidateQueries({
        queryKey: zoteroKeys.status(integrationId),
      });
    },
    onError: onMutationError('push to Zotero'),
  });
};

export const usePullFromZotero = (integrationId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (force?: boolean) => pullFromZotero(integrationId, force),
    onSuccess: () => {
      toast.success('Pull from Zotero started');
      queryClient.invalidateQueries({
        queryKey: zoteroKeys.status(integrationId),
      });
    },
    onError: onMutationError('pull from Zotero'),
  });
};

// ─── Derived hooks ────────────────────────────────────────────────────────────

export const useIsZoteroConfigured = (reviewId: number) => {
  const { data: integration, isLoading } = useZoteroIntegration(reviewId);
  return {
    isConfigured: integration?.isConfigured ?? false,
    integrationId: integration?.id,
    isLoading,
  };
};
