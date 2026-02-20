import {
  createReason,
  deleteReason,
  fetchReasons,
  updateReason,
} from '@/features/references/api/reasons';
import type { Reason } from '@/features/references/types/reasons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/* ------------------ FETCH ------------------ */
export const useFetchReasons = ({ reviewId }: { reviewId: number }) => {
  return useQuery({
    queryKey: ['reviews', reviewId, 'reasons'],
    queryFn: () => fetchReasons({ reviewId }),
    enabled: !!reviewId,
  });
};

/* ------------------ CREATE ------------------ */
export const useCreateReason = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reviewId,
      payload,
    }: {
      reviewId: number;
      payload: { name: string };
    }) => createReason({ review: reviewId, ...payload }),

    onSuccess: (data, variables) => {
      toast.success('Reason created.');

      queryClient.setQueryData(
        ['reviews', variables.reviewId, 'reasons'],
        (oldData: Reason[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },

    onError: () => {
      toast.error('Failed to create reason.');
    },
  });
};

/* ------------------ UPDATE ------------------ */
export const useUpdateReason = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reasonId,
      payload,
    }: {
      reasonId: number;
      reviewId: number;
      payload: { name: string };
    }) => updateReason(reasonId, payload),

    onSuccess: (data, variables) => {
      toast.success('Reason updated.');

      queryClient.setQueryData(
        ['reviews', variables.reviewId, 'reasons'],
        (oldData: Reason[] | undefined) => {
          if (!oldData) return oldData;

          return oldData.map((reason) =>
            reason.id === variables.reasonId ? data : reason
          );
        }
      );
    },

    onError: () => {
      toast.error('Failed to update reason.');
    },
  });
};

/* ------------------ DELETE ------------------ */
export const useDeleteReason = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reasonId }: { reasonId: number; reviewId: number }) =>
      deleteReason(reasonId),

    onSuccess: (_data, variables) => {
      toast.success('Reason deleted.');

      queryClient.setQueryData(
        ['reviews', variables.reviewId, 'reasons'],
        (oldData: Reason[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.filter((r) => r.id !== variables.reasonId);
        }
      );
    },

    onError: () => {
      toast.error('Failed to delete reason.');
    },
  });
};
