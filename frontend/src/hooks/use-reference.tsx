import { fetchReference, fetchReferences } from '@/api/reference';
import type { Reference } from '@/types/reference';
import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';

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
