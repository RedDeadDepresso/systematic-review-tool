import type { SearchMethod } from '@/features/references/api/references';
import {
  deleteSearchMethod,
  fetchSearchMethods,
} from '@/features/reviews/api/search-methods';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cacheRemove, onMutationError } from '@/lib/query-helpers';

export const searchMethodKeys = {
  list: (reviewId: number) => ['search-methods', reviewId] as const,
};

export const useFetchSearchMethods = (reviewId: number) =>
  useQuery({
    queryKey: searchMethodKeys.list(reviewId),
    queryFn: () => fetchSearchMethods(reviewId),
    enabled: !!reviewId,
  });

export const useDeleteSearchMethod = (reviewId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (searchMethodId: number) => deleteSearchMethod(searchMethodId),
    onSuccess: (_, searchMethodId) => {
      toast.success('Search method deleted.');
      queryClient.setQueryData<SearchMethod[]>(
        searchMethodKeys.list(reviewId),
        cacheRemove(searchMethodId)
      );
    },
    onError: onMutationError('delete search method'),
  });
};
