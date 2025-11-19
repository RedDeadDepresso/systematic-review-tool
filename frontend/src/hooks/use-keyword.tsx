import { createKeyword, fetchKeywords } from '@/api/keyword';
import type { Keyword } from '@/types/keyword';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useFetchKeywords = (params: {
  id: number | string;
  is_inclusive: boolean;
}) => {
  return useQuery({
    queryKey: ['keywords', params.id, params.is_inclusive],
    queryFn: () =>
      fetchKeywords({ reviewId: params.id, is_inclusive: params.is_inclusive }),
  });
};

export const useCreateKeyword = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createKeyword,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        ['keywords', Number(variables.review_id), variables.is_inclusive],
        (oldData: Keyword[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
  });
};
