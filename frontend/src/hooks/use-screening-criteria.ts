import {
  createScreeningCriteria,
  deleteScreeningCriteria,
  fetchScreeningCriteria,
  updateScreeningCriteria,
} from '@/api/screening-criteria';
import type { ScreeningCriteria } from '@/types/screening-criteria';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/* ------------------ FETCH SCREENING CRITERIA ------------------ */
export const useFetchScreeningCriteria = ({
  reviewId,
}: {
  reviewId: number;
}) => {
  return useQuery({
    queryKey: ['reviews', reviewId, 'screening-criteria'],
    queryFn: () => fetchScreeningCriteria({ reviewId: reviewId }),
  });
};

/* ------------------ CREATE SCREENING CRITERIA ------------------ */
export const useCreateScreeningCriteria = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createScreeningCriteria,
    onSuccess: (data, variables) => {
      toast.success('Screening criteria created.');

      queryClient.setQueryData(
        ['reviews', variables.review, 'screening-criteria'],
        (oldData: ScreeningCriteria[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },

    onError: () => {
      toast.error('Failed to create screening criteria.');
    },
  });
};

/* ------------------ UPDATE SCREENING CRITERIA ------------------ */
export const useUpdateScreeningCriteria = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      criteriaId,
      payload,
    }: {
      criteriaId: number;
      reviewId: number;
      payload: {
        name?: string;
        kind?: 'Inclusive' | 'Exclusive';
        description?: string;
      };
    }) => updateScreeningCriteria(criteriaId, payload),

    onSuccess: (data, variables) => {
      toast.success('Screening criteria updated.');

      queryClient.setQueryData(
        ['reviews', variables.reviewId, 'screening-criteria'],
        (oldData: ScreeningCriteria[] | undefined) => {
          if (!oldData) return oldData;

          return oldData.map((criteria) =>
            criteria.id === variables.criteriaId ? data : criteria
          );
        }
      );
    },

    onError: () => {
      toast.error('Failed to update screening criteria.');
    },
  });
};

/* ------------------ DELETE SCREENING CRITERIA ------------------ */
export const useDeleteScreeningCriteria = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ criteriaId }: { criteriaId: number; reviewId: number }) =>
      deleteScreeningCriteria(criteriaId),

    onSuccess: (_data, variables) => {
      toast.success('Screening criteria deleted.');

      queryClient.setQueryData(
        ['reviews', variables.reviewId, 'screening-criteria'],
        (oldData: ScreeningCriteria[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.filter(
            (criteria) => criteria.id !== variables.criteriaId
          );
        }
      );
    },

    onError: () => {
      toast.error('Failed to delete screening criteria.');
    },
  });
};
