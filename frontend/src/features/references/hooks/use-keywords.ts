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
import { applyCreate, cacheRemove, onMutationError } from '@/lib/query-helpers';

export const keywordKeys = {
  list: (reviewId: number, type: KeywordType) =>
    ['keywords', reviewId, type] as const,
};

export const useFetchKeywords = (params: {
  reviewId: number;
  type: KeywordType;
}) =>
  useQuery({
    queryKey: keywordKeys.list(params.reviewId, params.type),
    queryFn: () => fetchKeywords(params),
  });

export const useCreateKeyword = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createKeyword,
    onSuccess: (data, variables) =>
      applyCreate(
        queryClient,
        keywordKeys.list(variables.review, variables.type),
        data
      ),
    onError: onMutationError('create keyword'),
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
      queryClient.setQueryData<Keyword[]>(
        keywordKeys.list(variables.reviewId, variables.type),
        cacheRemove(variables.keywordId)
      );
    },
    onError: onMutationError('delete keyword'),
  });
};
