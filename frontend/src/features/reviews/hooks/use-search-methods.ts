import type { SearchMethod } from '@/features/references/api/references';
import {
  deleteSearchMethod,
  fetchSearchMethods,
} from '@/features/reviews/api/search-methods';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useFetchSearchMethods = (reviewId: number) => {
  return useQuery({
    queryKey: ['search-methods', reviewId],
    queryFn: () => fetchSearchMethods(reviewId),
    enabled: !!reviewId,
  });
};

export const useDeleteSearchMethod = (reviewId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (searchMethodId: number) => deleteSearchMethod(searchMethodId),
    onSuccess: (_, searchMethodId: number) => {
      toast.success('Search method deleted.');
      queryClient.setQueryData(
        ['search-methods', reviewId],
        (oldData: SearchMethod[]) => {
          if (!oldData) return [];
          return oldData.filter((method) => method.id !== searchMethodId);
        }
      );
    },
    onError: (error) => {
      console.error('Error deleting search method:', error);
      toast.error('Failed to delete search method.');
    },
  });
};
