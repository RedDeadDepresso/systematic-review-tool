import api from '@/api/client';
import type { Reference } from '@/features/references/types/references';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClusterStatus =
  | 'unresolved'
  | 'auto_resolved'
  | 'manually_resolved'
  | 'dismissed';

export type MemberRole = 'canonical' | 'duplicate' | 'pending';

export interface ClusterSearchMethod {
  id: number;
  name: string;
}

export interface ClusterReference {
  id: number;
  title: string;
  authors: string;
  journal: string;
  abstract: string;
  doi: string;
  publicationDate: string | null;
  pages: string;
  url: string;
  hasPdf: boolean;
  searchMethod: ClusterSearchMethod | null;
}

export interface ClusterMember {
  id: number;
  referenceId: number;
  role: MemberRole;
  bestSimilarityScore: number;
  doiMatched: boolean;
  completenessScore: number;
  reference: Reference;
}

export interface DuplicateCluster {
  id: string; // UUID
  status: ClusterStatus;
  doiMatch: boolean;
  maxSimilarityScore: number;
  canonicalReferenceId: number | null;
  createdAt: string;
  resolvedAt: string | null;
  members: ClusterMember[];
}

/**
 * Matches the non-paginated list response from DuplicateClusterViewSet.list()
 * Shape: { clusters: [...], resolved, remaining, total, progress }
 */
export interface FetchClustersResponse {
  clusters: DuplicateCluster[];
  resolved: number;
  remaining: number;
  total: number;
  progress: number;
  detail?: string;
}

export interface ClusterStats {
  unresolved: number;
  autoResolved: number;
  manuallyResolved: number;
  dismissed: number;
  affectedReferences: number;
}

export interface ResolveClusterResponse {
  message: string;
  clusterId: string;
  canonicalReferenceId: number;
}

export interface DismissClusterResponse {
  message: string;
  clusterId: string;
}

export interface AutoResolveResponse {
  message: string;
  taskId: string;
  status: string;
  confidenceThreshold: number;
  fuzzyThreshold: number;
  doiClustersAlways: boolean;
  preferredSearchMethodId: number | null;
}

// ─── Fetch clusters (list) ────────────────────────────────────────────────────

export interface FetchClustersParams {
  reviewId: number;
  status?: ClusterStatus;
  doiMatch?: boolean;
  minSimilarity?: number;
}

export const fetchDuplicateClusters = async ({
  reviewId,
  status,
  doiMatch,
  minSimilarity,
}: FetchClustersParams): Promise<FetchClustersResponse> => {
  const res = await api.get('/duplicate-clusters/', {
    params: {
      review: reviewId,
      ...(status ? { status } : {}),
      ...(doiMatch !== undefined ? { doiMatch } : {}),
      ...(minSimilarity !== undefined ? { minSimilarity } : {}),
    },
  });
  return res.data;
};

// ─── Fetch single cluster ─────────────────────────────────────────────────────

export const fetchDuplicateCluster = async (
  clusterId: string
): Promise<DuplicateCluster> => {
  const res = await api.get(`/duplicate-clusters/${clusterId}/`);
  return res.data;
};

// ─── Resolve cluster ──────────────────────────────────────────────────────────

export const resolveCluster = async (
  clusterId: string,
  canonicalReferenceId: number
): Promise<ResolveClusterResponse> => {
  const res = await api.post(`/duplicate-clusters/${clusterId}/resolve/`, {
    canonicalReferenceId,
  });
  return res.data;
};

// ─── Dismiss cluster ──────────────────────────────────────────────────────────

export const dismissCluster = async (
  clusterId: string
): Promise<DismissClusterResponse> => {
  const res = await api.post(`/duplicate-clusters/${clusterId}/dismiss/`);
  return res.data;
};

// ─── Cluster stats ────────────────────────────────────────────────────────────

export const fetchClusterStats = async (
  reviewId: number
): Promise<ClusterStats> => {
  const res = await api.get('/duplicate-clusters/stats/', {
    params: { review: reviewId },
  });
  return res.data;
};

// ─── Auto-resolve (on the Review viewset) ─────────────────────────────────────

export interface AutoResolveParams {
  confidenceThreshold: number;
  detectFirst: boolean;
  fuzzyThreshold: number;
  doiClustersAlways: boolean;
  preferredSearchMethodId: number | null;
}

export const autoResolveDuplicates = async (
  reviewId: number,
  params: AutoResolveParams
): Promise<AutoResolveResponse> => {
  const res = await api.post(
    `/reviews/${reviewId}/auto-resolve-duplicates/`,
    params
  );
  return res.data;
};
