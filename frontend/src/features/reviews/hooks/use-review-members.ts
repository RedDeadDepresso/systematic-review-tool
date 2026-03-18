import {
  deleteReviewMember,
  fetchReviewMembers,
  updateReviewMember,
} from '@/features/reviews/api/review-members';
import type {
  ReviewMember,
  ReviewRole,
} from '@/features/reviews/types/reviews';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyDelete, applyUpdate, onMutationError } from '@/lib/query-helpers';

export const reviewMemberKeys = {
  list: (reviewId: number | null) => ['review-members', reviewId] as const,
};

export const useFetchReviewMembers = (
  reviewId: number | null,
  enabled = false
) =>
  useQuery({
    queryKey: reviewMemberKeys.list(reviewId),
    queryFn: () => fetchReviewMembers(reviewId!),
    enabled: !!reviewId && enabled,
  });

export const useUpdateReviewMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      reviewId: number;
      payload: { role: ReviewRole };
    }) => updateReviewMember(id, payload),
    onSuccess: (data, variables) =>
      applyUpdate(
        queryClient,
        reviewMemberKeys.list(variables.reviewId),
        data,
        'Member role updated.'
      ),
    onError: onMutationError('update member role'),
  });
};

export const useDeleteReviewMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; reviewId: number }) =>
      deleteReviewMember(id),
    onSuccess: (_, variables) =>
      applyDelete<ReviewMember>(
        queryClient,
        reviewMemberKeys.list(variables.reviewId),
        variables.id,
        'Member removed successfully.'
      ),
    onError: onMutationError('remove member'),
  });
};
