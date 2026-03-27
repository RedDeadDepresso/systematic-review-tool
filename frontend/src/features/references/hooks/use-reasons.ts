import {
  createReason,
  deleteReason,
  fetchReasons,
  updateReason,
} from '@/features/references/api/reasons';
import type { Reason } from '@/features/references/types/reasons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyCreate,
  applyDelete,
  applyUpdate,
  onMutationError,
} from '@/lib/query-helpers';

export const reasonKeys = {
  list: (reviewId: number) => ['reviews', reviewId, 'reasons'] as const,
};

export const useFetchReasons = ({ reviewId }: { reviewId: number }) =>
  useQuery({
    queryKey: reasonKeys.list(reviewId),
    queryFn: () => fetchReasons({ reviewId }),
    enabled: !!reviewId,
  });

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
    onSuccess: (data, variables) =>
      applyCreate(
        queryClient,
        reasonKeys.list(variables.reviewId),
        data,
        'Reason created.'
      ),
    onError: onMutationError('create reason'),
  });
};

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
    onSuccess: (data, variables) =>
      applyUpdate(
        queryClient,
        reasonKeys.list(variables.reviewId),
        data,
        'Reason updated.'
      ),
    onError: onMutationError('update reason'),
  });
};

export const useDeleteReason = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reasonId }: { reasonId: number; reviewId: number }) =>
      deleteReason(reasonId),
    onSuccess: (_data, variables) =>
      applyDelete<Reason>(
        queryClient,
        reasonKeys.list(variables.reviewId),
        variables.reasonId,
        'Reason deleted.'
      ),
    onError: onMutationError('delete reason'),
  });
};
