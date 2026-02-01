import {
  detectDuplicateReferences,
  fetchDuplicateReferences,
  resolveDuplicateReferences,
} from '@/api/reference-duplicate';
import type { Review } from '@/types/review';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { toast } from 'sonner';

export const useDetectDuplicateReferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId }: { reviewId: number }) =>
      detectDuplicateReferences(reviewId),
    onSuccess: (
      { duplicatesFoundCount }: { duplicatesFoundCount: number },
      { reviewId }: { reviewId: number }
    ) => {
      toast.success(
        `${duplicatesFoundCount} Duplicate references have been found.`
      );
      queryClient.setQueryData(['reviews', reviewId], (oldData: Review) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          referenceDuplicatesCount:
            oldData.referenceDuplicatesCount + duplicatesFoundCount,
        };
      });
    },
    onError: (error: unknown) => {
      console.log('error', error);
      const axiosError = error as AxiosError;
      const data = axiosError?.response?.data;
      const message =
        data && typeof data === 'object' && 'detail' in data
          ? (data as { detail?: string }).detail
          : undefined;
      if (message) toast.error(message);
    },
  });
};

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
          referenceDuplicatesCount: oldData.referenceDuplicatesCount - 1,
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
