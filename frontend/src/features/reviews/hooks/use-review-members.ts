import {
  deleteReviewMember,
  updateReviewMember,
} from '@/features/reviews/api/review-members';
import type {
  Review,
  ReviewMember,
  ReviewRole,
} from '@/features/reviews/types/reviews';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getReviewMembers } from '@/features/reviews/api/review-members';

export const useReviewMembers = (reviewId: number | null) => {
  return useQuery({
    queryKey: ['review-members', reviewId],
    queryFn: () => getReviewMembers(reviewId!),
    enabled: !!reviewId,
  });
};

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

    onSuccess: (updatedMember, variables) => {
      queryClient.setQueryData(
        ['reviews', variables.reviewId],
        (oldReview: Review) => {
          if (!oldReview) return oldReview;

          return {
            ...oldReview,
            members: oldReview.members.map((member: ReviewMember) =>
              member.id === updatedMember.id ? updatedMember : member
            ),
          };
        }
      );

      toast.success('Member role updated.');
    },

    onError: () => {
      toast.error('Failed to update member role.');
    },
  });
};

export const useDeleteReviewMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: number; reviewId: number }) =>
      deleteReviewMember(id),

    onSuccess: (_, variables) => {
      queryClient.setQueryData(
        ['reviews', variables.reviewId],
        (oldReview: Review) => {
          if (!oldReview) return oldReview;

          return {
            ...oldReview,
            members: oldReview.members.filter(
              (member: ReviewMember) => member.id !== variables.id
            ),
          };
        }
      );

      toast.success('Member removed successfully.');
    },

    onError: () => {
      toast.error('Failed to remove member.');
    },
  });
};
