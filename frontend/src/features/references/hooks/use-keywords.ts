import {
  createKeyword,
  deleteKeyword,
  fetchKeywords,
} from '@/features/references/api/keywords';
import type {
  Keyword,
  KeywordType,
} from '@/features/references/types/keywords';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useFetchKeywords = (params: {
  reviewId: number;
  type: KeywordType;
}) => {
  return useQuery({
    queryKey: ['keywords', params.reviewId, params.type],
    queryFn: () => fetchKeywords(params),
  });
};

export const useCreateKeyword = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createKeyword,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        ['keywords', variables.review, variables.type],
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
      type: KeywordType;
    }) => deleteKeyword(payload.keywordId),
    onSuccess: (_, variables) => {
      toast.success('Keyword deleted successfully.');
      queryClient.setQueryData(
        ['keywords', variables.reviewId, variables.type],
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
