import {
  createKeyword,
  deleteKeyword,
  fetchKeywords,
} from '@/features/references/api/keywords';
import type { Keyword } from '@/features/references/types/keywords';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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

export const useDeleteKeyword = () => {
  return useMutation({
    mutationFn: deleteKeyword,
    onSuccess: () => {
      toast.success('Keyword deleted successfully.');
    },
    onError: () => {
      toast.error('Delete failed.');
    },
  });
};
