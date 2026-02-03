import { deleteReviewMember, updateReviewMember } from '@/api/review-member';
import type { Review, ReviewMember, ReviewRole } from '@/types/review';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
