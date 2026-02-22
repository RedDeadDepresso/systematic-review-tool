import {
  fetchDuplicateReferences,
  resolveDuplicateReferences,
} from '@/features/references/api/reference-duplicates';
import type { Review } from '@/features/reviews/types/reviews';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { toast } from 'sonner';

export const useFetchDuplicateReferences = ({
  reviewId,
}: {
  reviewId: number;
}) => {
  return useQuery({
    queryKey: ['reviews', reviewId, 'referenceDuplicatePair'],
    queryFn: () => fetchDuplicateReferences(reviewId),
  });
};

export const useResolveDuplicateReferences = () => {
  const queryClient = useQueryClient();
  return useMutation<
    { detail: string },
    unknown,
    {
      reviewId: number;
      referenceDuplicateId: number;
      selection: 1 | 2 | 3;
    }
  >({
    mutationFn: ({ reviewId, referenceDuplicateId, selection }) =>
      resolveDuplicateReferences(referenceDuplicateId, reviewId, selection),
    onSuccess: ({ detail }: { detail: string }, { reviewId }) => {
      toast.success(`${detail}`);
      queryClient.invalidateQueries({
        queryKey: ['reviews', reviewId, 'referenceDuplicatePair'],
      });
      queryClient.setQueryData(['reviews', reviewId], (oldData: Review) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          duplicatePairsUnresolvedCount:
            oldData.duplicatePairsUnresolvedCount === null
              ? null
              : oldData.duplicatePairsUnresolvedCount - 1,
        };
      });
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError;
      const message =
        axiosError?.response?.data &&
        typeof axiosError.response.data === 'object' &&
        'error' in axiosError.response.data
          ? (axiosError.response.data as { error?: string }).error
          : undefined;
      if (message) toast.error(message);
    },
  });
};
