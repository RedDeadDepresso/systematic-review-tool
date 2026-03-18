import {
  createScreeningCriteria,
  deleteScreeningCriteria,
  fetchScreeningCriteria,
  updateScreeningCriteria,
} from '@/features/reviews/api/screening-criteria';
import type { ScreeningCriteria } from '@/features/reviews/types/screening-criteria';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyCreate,
  applyDelete,
  applyUpdate,
  onMutationError,
} from '@/lib/query-helpers';

export const screeningCriteriaKeys = {
  list: (reviewId: number) =>
    ['reviews', reviewId, 'screening-criteria'] as const,
};

export const useFetchScreeningCriteria = ({ reviewId }: { reviewId: number }) =>
  useQuery({
    queryKey: screeningCriteriaKeys.list(reviewId),
    queryFn: () => fetchScreeningCriteria({ reviewId }),
  });

export const useCreateScreeningCriteria = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createScreeningCriteria,
    onSuccess: (data, variables) =>
      applyCreate(
        queryClient,
        screeningCriteriaKeys.list(variables.review),
        data,
        'Screening criteria created.'
      ),
    onError: onMutationError('create screening criteria'),
  });
};

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
        type?: 'inclusion' | 'exclusion';
        description?: string;
      };
    }) => updateScreeningCriteria(criteriaId, payload),
    onSuccess: (data, variables) =>
      applyUpdate(
        queryClient,
        screeningCriteriaKeys.list(variables.reviewId),
        data,
        'Screening criteria updated.'
      ),
    onError: onMutationError('update screening criteria'),
  });
};

export const useDeleteScreeningCriteria = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ criteriaId }: { criteriaId: number; reviewId: number }) =>
      deleteScreeningCriteria(criteriaId),
    onSuccess: (_data, variables) =>
      applyDelete<ScreeningCriteria>(
        queryClient,
        screeningCriteriaKeys.list(variables.reviewId),
        variables.criteriaId,
        'Screening criteria deleted.'
      ),
    onError: onMutationError('delete screening criteria'),
  });
};
