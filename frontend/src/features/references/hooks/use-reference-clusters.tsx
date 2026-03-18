import {
  fetchDuplicateClusters,
  fetchDuplicateCluster,
  resolveCluster,
  dismissCluster,
  fetchClusterStats,
  autoResolveDuplicates,
  type FetchClustersParams,
  type AutoResolveParams,
} from '@/features/references/api/reference-clusters';
import type { Review } from '@/features/reviews/types/reviews';
import { errorMessageString } from '@/lib/error';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const duplicateKeys = {
  all: (reviewId: number) =>
    ['reviews', reviewId, 'duplicateClusters'] as const,
  list: (reviewId: number, filters?: Omit<FetchClustersParams, 'reviewId'>) =>
    ['reviews', reviewId, 'duplicateClusters', 'list', filters] as const,
  detail: (clusterId: string) => ['duplicateClusters', clusterId] as const,
  stats: (reviewId: number) => ['reviews', reviewId, 'clusterStats'] as const,
};

// ─── Fetch cluster list ───────────────────────────────────────────────────────

export const useFetchDuplicateClusters = (params: FetchClustersParams) => {
  return useQuery({
    queryKey: duplicateKeys.list(params.reviewId, {
      status: params.status,
      doiMatch: params.doiMatch,
      minSimilarity: params.minSimilarity,
    }),
    queryFn: () => fetchDuplicateClusters(params),
  });
};

// ─── Fetch single cluster ─────────────────────────────────────────────────────

export const useFetchDuplicateCluster = (clusterId: string | undefined) => {
  return useQuery({
    queryKey: duplicateKeys.detail(clusterId!),
    queryFn: () => fetchDuplicateCluster(clusterId!),
    enabled: !!clusterId,
  });
};

// ─── Cluster stats ────────────────────────────────────────────────────────────

export const useFetchClusterStats = ({ reviewId }: { reviewId: number }) => {
  return useQuery({
    queryKey: duplicateKeys.stats(reviewId),
    queryFn: () => fetchClusterStats(reviewId),
  });
};

// ─── Resolve cluster (manual) ─────────────────────────────────────────────────

export const useResolveCluster = (reviewId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clusterId,
      canonicalReferenceId,
    }: {
      clusterId: string;
      canonicalReferenceId: number;
    }) => resolveCluster(clusterId, canonicalReferenceId),

    onSuccess: ({ message }) => {
      toast.success(message || 'Cluster resolved');
      _invalidateClusters(queryClient, reviewId);
    },
    onError: (error: any) => {
      toast.error(`Failed to resolve cluster: ${errorMessageString(error)}`);
    },
  });
};

// ─── Dismiss cluster ──────────────────────────────────────────────────────────

export const useDismissCluster = (reviewId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clusterId }: { clusterId: string }) =>
      dismissCluster(clusterId),

    onSuccess: ({ message }) => {
      toast.success(message || 'Cluster dismissed');
      _invalidateClusters(queryClient, reviewId);
    },
    onError: (error: any) => {
      toast.error(`Failed to dismiss cluster: ${errorMessageString(error)}`);
    },
  });
};

// ─── Auto-resolve ─────────────────────────────────────────────────────────────

export const useAutoResolveDuplicates = (reviewId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: AutoResolveParams) =>
      autoResolveDuplicates(reviewId, params),

    onSuccess: ({ message }) => {
      toast.success(message || 'Auto-resolution started');
      _invalidateClusters(queryClient, reviewId);
    },
    onError: (error: any) => {
      toast.error(`Failed to auto-resolve: ${errorMessageString(error)}`);
    },
  });
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

function _invalidateClusters(
  queryClient: ReturnType<typeof useQueryClient>,
  reviewId: number
) {
  queryClient.invalidateQueries({ queryKey: duplicateKeys.all(reviewId) });
  queryClient.invalidateQueries({ queryKey: duplicateKeys.stats(reviewId) });

  // Optimistically decrement the unresolved cluster count on the review
  queryClient.setQueryData(['reviews', reviewId], (old: Review) => {
    if (!old) return old;
    return {
      ...old,
      duplicateClustersUnresolved:
        old.duplicateClustersUnresolvedCount != null
          ? Math.max(0, old.duplicateClustersUnresolvedCount - 1)
          : null,
    };
  });
}
