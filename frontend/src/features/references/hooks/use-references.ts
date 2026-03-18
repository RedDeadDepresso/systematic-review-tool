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
import { onMutationError } from '@/lib/query-helpers';
import { uploadedPdfKeys } from '@/features/references/hooks/use-uploaded-pdfs';
import { codeKeys } from '@/features/coding/hooks/use-codes';

// ─── Query keys ────────────────────────────────────────────────────────────────

export const referenceKeys = {
  list: (
    params: FetchReviewDataParams,
    endpoint: ReferencesEndpoint = ENDPOINTS.reviewData
  ) => ['reviews', params.review, endpoint, 'references', params] as const,
  filterCounts: (
    reviewId: number,
    endpoint: ReferencesEndpoint = ENDPOINTS.reviewData
  ) => ['reviews', reviewId, endpoint, 'filter-counts'] as const,
  detail: (id: number) => ['references', id] as const,
  byReview: (reviewId: number) => ['reviews', reviewId, 'references'] as const,
};

// ─── Infinite references ───────────────────────────────────────────────────────

export const useFetchReferences = <T extends Reference = Reference>(
  params: Omit<FetchReviewDataParams | FetchScreeningParams, 'offset'>,
  endpoint: ReferencesEndpoint | string = ENDPOINTS.reviewData
) => {
  const PAGE_SIZE = params.limit ?? 50;
  return useInfiniteQuery<
    FetchReferencesResponse<T>,
    Error,
    InfiniteData<FetchReferencesResponse<T>>,
    readonly [string, number, string, string, object],
    number
  >({
    queryKey: referenceKeys.list(
      { ...params, limit: PAGE_SIZE } as FetchReviewDataParams,
      endpoint as ReferencesEndpoint
    ),
    queryFn: ({ pageParam }) =>
      fetchReferences(
        { ...params, limit: PAGE_SIZE, offset: pageParam },
        endpoint
      ) as Promise<FetchReferencesResponse<T>>,
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

/** Flatten all pages into a single reference array. */
export const selectFlatReferences = <T extends Reference = Reference>(
  data: InfiniteData<FetchReferencesResponse<T>> | undefined
): T[] => data?.pages.flatMap((p) => p.references) ?? [];

/** Extract count metadata from the first page. */
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

// ─── Filter counts ─────────────────────────────────────────────────────────────

export const useFetchFilterCounts = (
  reviewId: number,
  endpoint: ReferencesEndpoint | string = ENDPOINTS.reviewData
) =>
  useQuery({
    queryKey: referenceKeys.filterCounts(
      reviewId,
      endpoint as ReferencesEndpoint
    ),
    queryFn: () => fetchFilterCounts(reviewId, endpoint),
    staleTime: 2 * 60 * 1000,
    enabled: !!reviewId,
  });

export const useFetchReference = (id: number) =>
  useQuery({
    queryKey: referenceKeys.detail(id),
    queryFn: () => fetchReference(id),
  });

export const useUpdateReference = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateReference,
    onSuccess: (updatedReference, { reviewId }) => {
      queryClient.setQueryData<Reference[]>(
        referenceKeys.byReview(reviewId),
        (old = []) =>
          old.map((ref) =>
            ref.id === updatedReference.id ? updatedReference : ref
          )
      );
    },
  });
};

export const useUploadReferenceFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadReferenceFile,
    onSuccess: (updatedReference, { reviewId }) => {
      toast.success('Reference file has been uploaded.');
      queryClient.setQueryData<Reference[]>(
        referenceKeys.byReview(reviewId),
        (old = []) =>
          old.map((ref) =>
            ref.id === updatedReference.id ? updatedReference : ref
          )
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

      queryClient.setQueryData<Reference[]>(
        referenceKeys.byReview(reviewId),
        (old = []) =>
          old.map((ref) => {
            const updated = updatedReferences.find(
              (u: { id: number }) => u.id === ref.id
            );
            return updated ? { ...ref, file: updated.file } : ref;
          })
      );

      const deletedIds = updatedReferences.map(
        (u: { uploadedPdfId: number }) => u.uploadedPdfId
      );
      queryClient.setQueryData<UploadedPDF[]>(
        uploadedPdfKeys.list(reviewId),
        (old = []) => old.filter((pdf) => !deletedIds.includes(pdf.id))
      );

      queryClient.invalidateQueries({ queryKey: codeKeys.list(reviewId) });
    },
    onError: (error: AxiosError) => {
      console.log(error);
      toast.error(
        `Failed to attach PDFs to references: ${error?.message ?? error}`
      );
    },
  });
};

export const useAssignReferences = () =>
  useMutation({
    mutationFn: (params: AssignReferencesPayload) => assignReferences(params),
    onSuccess: () => toast.success('References updated successfully.'),
    onError: onMutationError('assign references'),
  });

export const useAutoMatch = () =>
  useMutation({
    mutationFn: autoMatch,
    onSuccess: (data) =>
      toast.success(`Matches: ${data.matched}. No matches: ${data.unmatched} `),
    onError: onMutationError('find matches'),
  });
