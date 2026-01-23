import { createKeyword, fetchKeywords } from '@/api/keyword';
import type { Keyword } from '@/types/keyword';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useFetchKeywords = (params: {
  id: number;
  isInclusive: boolean;
}) => {
  return useQuery({
    queryKey: ['keywords', params.id, params.isInclusive],
    queryFn: () =>
      fetchKeywords({ reviewId: params.id, isInclusive: params.isInclusive }),
  });
};

export const useCreateKeyword = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createKeyword,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        ['keywords', variables.review, variables.isInclusive],
        (oldData: Keyword[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
  });
};
