import {
  updateReference,
  fetchReference,
  uploadReferenceFile,
  attachPDFsToReferences,
  type FetchReviewDataParams,
  assignReferences,
  type AssignReferencesPayload,
  autoMatch,
  fetchFilterCounts,
  type FetchReferencesResponse,
  type ReferencesEndpoint,
  type FetchScreeningParams,
  ENDPOINTS,
  fetchReferences,
} from '@/features/references/api/references';
import type { Reference } from '@/features/references/types/references';
import type { UploadedPDF } from '@/features/references/types/uploaded-pdfs';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { toast } from 'sonner';

// ─── Query keys ────────────────────────────────────────────────────────────────

// Updated referenceKeys to include endpoint
export const referenceKeys = {
  list: (params: FetchReviewDataParams, endpoint = ENDPOINTS.reviewData) =>
    ['reviews', params.review, endpoint, 'references', params] as const,
  filterCounts: (reviewId: number, endpoint = ENDPOINTS.reviewData) =>
    ['reviews', reviewId, endpoint, 'filter-counts'] as const,
};

// ─── Infinite references (pagination + sort) ───────────────────────────────────

/**
 * Infinite scroll hook for the references table.
 *
 * Usage in the component:
 *
 *   const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
 *     useFetchReferences(params);
 *
 *   // Flatten pages into a single array:
 *   const references = data?.pages.flatMap(p => p.references) ?? [];
 *
 * Trigger fetchNextPage when the user scrolls near the bottom of the list.
 */
export const useFetchReferences = (
  params: Omit<FetchReviewDataParams | FetchScreeningParams, 'offset'>,
  endpoint: ReferencesEndpoint | string = ENDPOINTS.reviewData
) => {
  const PAGE_SIZE = params.limit ?? 50;

  return useInfiniteQuery<
    FetchReferencesResponse,
    Error,
    InfiniteData<FetchReferencesResponse>,
    readonly [string, number, string, string, object],
    number
  >({
    queryKey: [
      'reviews',
      params.review,
      endpoint,
      'references',
      { ...params, limit: PAGE_SIZE },
    ] as const,
    queryFn: ({ pageParam }) =>
      fetchReferences(
        { ...params, limit: PAGE_SIZE, offset: pageParam },
        endpoint
      ),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.next ? last.offset + last.limit : undefined,
    getPreviousPageParam: (first) =>
      first.previous && first.offset > 0
        ? Math.max(0, first.offset - first.limit)
        : undefined,
    placeholderData: (prev) => prev,
  });
};

/**
 * Selector to flatten all pages into a single reference array.
 * Memoised by React Query's structural equality check on `data`.
 */
export const selectFlatReferences = (
  data: InfiniteData<FetchReferencesResponse> | undefined
): Reference[] => data?.pages.flatMap((p) => p.references) ?? [];

/**
 * Get counts from the first page (same for all pages).
 */
export const selectPageMeta = (
  data: InfiniteData<FetchReferencesResponse> | undefined
) =>
  data?.pages[0]
    ? {
        totalCount: data.pages[0].totalCount,
        filteredCount: data.pages[0].filteredCount,
        totalMatchingCount: data.pages[0].count,
      }
    : { totalCount: 0, filteredCount: 0, totalMatchingCount: 0 };

// ─── Filter counts (sidebar aggregations) ─────────────────────────────────────

export const useFetchFilterCounts = (
  reviewId: number,
  endpoint: ReferencesEndpoint | string = ENDPOINTS.reviewData
) =>
  useQuery({
    queryKey: ['reviews', reviewId, endpoint, 'filter-counts'] as const,
    queryFn: () => fetchFilterCounts(reviewId, endpoint),
    staleTime: 2 * 60 * 1000,
    enabled: !!reviewId,
  });

export const useFetchReference = (id: number) => {
  return useQuery({
    queryKey: ['references', id],
    queryFn: () => fetchReference(id),
  });
};

export const useUpdateReference = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateReference,
    onSuccess: (updatedReference, { reviewId: reviewId }) => {
      queryClient.setQueryData(
        ['reviews', reviewId, 'references'],
        (oldData: []) => {
          if (!oldData) return oldData;
          return oldData.map((ref: Reference) =>
            ref.id === updatedReference.id ? updatedReference : ref
          );
        }
      );
    },
  });
};

export const useUploadReferenceFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadReferenceFile,
    onSuccess: (updatedReference, { reviewId: reviewId }) => {
      toast.success(`Reference file has been uploaded.`);
      queryClient.setQueryData(
        ['reviews', reviewId, 'references'],
        (oldData: []) => {
          if (!oldData) return oldData;
          return oldData.map((ref: Reference) =>
            ref.id === updatedReference.id ? updatedReference : ref
          );
        }
      );
    },
    onError: (error: AxiosError) => {
      const message =
        error?.response?.data &&
        typeof error.response.data === 'object' &&
        'error' in error.response.data
          ? (error.response.data as { error?: string }).error
          : undefined;
      if (message) toast.error(message);
    },
  });
};

export const useAttachPDFsToReferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: attachPDFsToReferences,

    onSuccess: ({ updatedReferences }, { reviewId }) => {
      toast.success('PDFs have been successfully attached to references.');
      // Update references cache
      queryClient.setQueryData(
        ['reviews', reviewId, 'references'],
        (oldData: Reference[] | undefined) => {
          if (!oldData) return oldData;

          return oldData.map((ref) => {
            const updated = updatedReferences.find(
              (u: { id: number }) => u.id === ref.id
            );
            return updated ? { ...ref, file: updated.file } : ref;
          });
        }
      );

      // Remove deleted uploaded PDFs from cache
      queryClient.setQueryData(
        ['reviews', reviewId, 'uploaded-pdfs'],
        (oldData: UploadedPDF[] | undefined) => {
          if (!oldData) return oldData;

          // Remove PDFs that were attached
          const deletedIds = updatedReferences.map(
            (u: { uploadedPdfId: number }) => u.uploadedPdfId
          );
          return oldData.filter((pdf) => !deletedIds.includes(pdf.id));
        }
      );

      queryClient.invalidateQueries({
        queryKey: ['reviews', reviewId, 'codes'],
      });
    },

    onError: (error: AxiosError) => {
      console.log(error);
      toast.error('Failed to attach PDFs to references.');
    },
  });
};

export const useAssignReferences = () => {
  return useMutation({
    mutationFn: (params: AssignReferencesPayload) => assignReferences(params),
    onSuccess: () => {
      toast.success('References updated successfully.');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to assign references.');
    },
  });
};

export const useAutoMatch = () => {
  return useMutation({
    mutationFn: autoMatch,
    onSuccess: (data) => {
      toast.success(`Matches: ${data.matched}. No matches: ${data.unmatched} `);
    },
    onError: () => {
      toast.error(`Error founding matches.`);
    },
  });
};
