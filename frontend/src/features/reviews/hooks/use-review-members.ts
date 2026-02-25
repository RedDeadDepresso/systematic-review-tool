import {
  deleteReviewMember,
  updateReviewMember,
} from '@/features/reviews/api/review-members';
import type {
  ReviewMember,
  ReviewRole,
} from '@/features/reviews/types/reviews';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchReviewMembers } from '@/features/reviews/api/review-members';

export const useFetchReviewMembers = (
  reviewId: number | null,
  enabled: boolean = false
) => {
  return useQuery({
    queryKey: ['review-members', reviewId],
    queryFn: () => fetchReviewMembers(reviewId!),
    enabled: !!reviewId && enabled,
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
        ['review-members', variables.reviewId],
        (oldData: ReviewMember[]) => {
          if (!oldData) return oldData;
          return oldData.map((member) =>
            member.id === variables.id ? updatedMember : member
          );
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
        ['review-members', variables.reviewId],
        (oldData: ReviewMember[]) => {
          if (!oldData) return oldData;
          return oldData.filter((member) => member.id !== variables.id);
        }
      );

      toast.success('Member removed successfully.');
    },
    onError: () => {
      toast.error('Failed to remove member.');
    },
  });
};
