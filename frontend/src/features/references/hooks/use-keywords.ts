import {
  createKeyword,
  deleteKeyword,
  fetchKeywords,
} from '@/features/references/api/keywords';
import type { Keyword } from '@/features/references/types/keywords';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useFetchKeywords = (params: {
  reviewId: number;
  isInclusive: boolean;
}) => {
  return useQuery({
    queryKey: ['keywords', params.reviewId, params.isInclusive],
    queryFn: () => fetchKeywords(params),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      reviewId: number;
      keywordId: number;
      isInclusive: boolean;
    }) => deleteKeyword(payload.keywordId),
    onSuccess: (_, variables) => {
      toast.success('Keyword deleted successfully.');
      queryClient.setQueryData(
        ['keywords', variables.reviewId, variables.isInclusive],
        (oldData: Keyword[] = []) => {
          if (!oldData) return [];
          return oldData.filter((k) => k.id !== variables.keywordId);
        }
      );
    },
    onError: () => {
      toast.error('Delete failed.');
    },
  });
};
