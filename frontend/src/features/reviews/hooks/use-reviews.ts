import {
  createReview,
  deleteReview,
  updateReview,
  fetchReview,
  fetchReviews,
  UploadReviewReferences,
  fetchArticleCounts,
  addData,
  createReviewPrisma,
  detectDuplicateReferences,
  autoResolveDuplicates,
  type AutoResolveRequest,
} from '@/features/reviews/api/reviews';
import type { Review } from '@/features/reviews/types/reviews';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { type Stage } from '@/features/references/types/references';
import { applyCreate, onMutationError } from '@/lib/query-helpers';

export const reviewKeys = {
  list: (params: { isActive: boolean }) => ['reviews', params] as const,
  detail: (id: number | null) => ['reviews', id] as const,
  prisma: (id: number) => ['reviews', id, 'prisma'] as const,
  articleCounts: (reviewId: number, params?: { stage?: Stage }) =>
    ['articleCounts', reviewId, params] as const,
  references: (reviewId: number) =>
    ['reviews', reviewId, 'references'] as const,
};

export const useFetchReviews = ({
  isActive,
  enabled = true,
}: {
  isActive: boolean;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: reviewKeys.list({ isActive }),
    queryFn: () => fetchReviews({ isActive }),
    enabled,
  });

export const useFetchReview = (id: number | null) =>
  useQuery({
    queryKey: reviewKeys.detail(id),
    queryFn: () => fetchReview(id!),
    enabled: !!id,
  });

export const useCreateReviewPrisma = (id: number) =>
  useQuery({
    queryKey: reviewKeys.prisma(id),
    queryFn: () => createReviewPrisma(id),
  });

export const useFetchArticleCounts = (
  reviewId: number,
  params?: { stage?: Stage }
) =>
  useQuery({
    queryKey: reviewKeys.articleCounts(reviewId, params),
    queryFn: () => fetchArticleCounts(reviewId, params),
  });

export const useAddData = (reviewId: number) =>
  useMutation({
    mutationFn: (payload: {
      dataSource: string;
      dataSink: string;
      articleTypes: string[];
      labelIds: number[];
    }) => addData(reviewId, payload),
    onError: onMutationError('add data'),
  });

export const useCreateReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReview,
    onSuccess: (data) =>
      applyCreate(
        queryClient,
        reviewKeys.list({ isActive: true }),
        data,
        'Review has been created.'
      ),
    onError: onMutationError('create review'),
  });
};

export const useUpdateReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateReview,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(reviewKeys.detail(variables.id), data);
      if (variables.payload?.isBlinded !== undefined) {
        queryClient.invalidateQueries({
          queryKey: reviewKeys.references(variables.id),
        });
      }
      toast.success('Review has been updated.');
    },
    onError: onMutationError('update review'),
  });
};

export const useUploadReviewReferences = () =>
  useMutation({
    mutationFn: UploadReviewReferences,
    onSuccess: () => toast.success('References have been uploaded.'),
    onError: onMutationError('upload references'),
  });

export const useDeleteReview = () =>
  useMutation({
    mutationFn: deleteReview,
    onSuccess: () => toast.success('Review deleted successfully.'),
    onError: onMutationError('delete review'),
  });

export const useDetectDuplicateReferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId }: { reviewId: number }) =>
      detectDuplicateReferences(reviewId),
    onSuccess: (_, { reviewId }) => {
      toast.success('Duplicate detection started.');
      queryClient.setQueryData(reviewKeys.detail(reviewId), (old: Review) => {
        if (!old) return old;
        return {
          ...old,
          duplicateClustersCount: null,
          duplicateDetectionStatus: 'Pending',
        };
      });
    },
    onError: onMutationError('detect duplicates'),
  });
};

export const useAutoResolveDuplicates = (reviewId: number) =>
  useMutation({
    mutationFn: (settings: AutoResolveRequest) =>
      autoResolveDuplicates(reviewId, settings),
    onSuccess: (data) =>
      toast.success(
        `Auto-resolution started with ${Math.round(data.confidenceThreshold * 100)}% confidence threshold`
      ),
    onError: onMutationError('start auto-resolution'),
  });
