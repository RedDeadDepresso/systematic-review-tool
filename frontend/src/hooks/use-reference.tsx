import {
  detectDuplicateReferences,
  fetchReference,
  fetchReferences,
} from '@/api/reference';
import type { Reference } from '@/types/reference';
import type { Review } from '@/types/review';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { toast } from 'sonner';

export const useFetchReferences = ({
  reviewId,
}: {
  reviewId: string | number;
}) => {
  return useQuery({
    queryKey: ['reviews', reviewId, 'references'],
    queryFn: () => fetchReferences(reviewId),
  });
};

export const useFetchReference = (
  params: { reviewId?: string | number; referenceId?: string | number },
  options?: Omit<
    UseQueryOptions<
      Reference,
      Error,
      Reference,
      [string, string | number | undefined]
    >,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<Reference, Error> => {
  return useQuery<
    Reference,
    Error,
    Reference,
    [string, string | number | undefined]
  >({
    queryKey: ['references', params?.referenceId],
    queryFn: () => fetchReference(params!.reviewId!, params!.referenceId!),
    enabled: !!params?.reviewId && !!params?.referenceId,
    ...options,
  });
};

export const useDetectDuplicateReferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId }: { reviewId: number | string }) =>
      detectDuplicateReferences(reviewId),
    onSuccess: (
      { duplicates_found_count }: { duplicates_found_count: number },
      { reviewId }: { reviewId: number | string }
    ) => {
      toast.success(
        `${duplicates_found_count} Duplicate references have been found.`
      );
      queryClient.setQueryData(['reviews', reviewId], (oldData: Review) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          reference_duplicates_count:
            oldData.reference_duplicates_count + duplicates_found_count,
        };
      });
    },
    onError: (error: AxiosError) => {
      const message = error?.response?.data?.error;
      if (message) toast.error(message);
    },
  });
};
