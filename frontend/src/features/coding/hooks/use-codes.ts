import {
  createCode,
  deleteCode,
  fetchCodes,
  updateCode,
} from '@/features/coding/api/codes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Code } from '@/features/coding/types/codes';
import type { SubTheme } from '@/features/coding/types/sub-themes';
import {
  applyCreate,
  applyDelete,
  applyUpdate,
  onMutationError,
} from '@/lib/query-helpers';
import { subThemeKeys } from '@/features/coding/hooks/use-sub-themes';

export const codeKeys = {
  list: (reviewId: number) => ['reviews', reviewId, 'codes'] as const,
};

export function useFetchCodes(reviewId: number) {
  return useQuery({
    queryKey: codeKeys.list(reviewId),
    queryFn: () => fetchCodes(reviewId),
    enabled: !!reviewId,
  });
}

export function useCreateCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCode,
    onSuccess: (data, variables) =>
      applyCreate(
        queryClient,
        codeKeys.list(variables.review),
        data,
        'Code has been created.'
      ),
    onError: onMutationError('create code'),
  });
}

export function useUpdateCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCode,
    onSuccess: (data, variables) => {
      toast.success('Code has been updated.');
      // Re-assign the code to its new sub-theme if it changed
      if (variables.payload.subTheme !== undefined) {
        queryClient.setQueryData(
          subThemeKeys.list(data.review),
          (oldData: SubTheme[] = []) =>
            oldData.map((st) => ({
              ...st,
              codeIds: st.codeIds.filter((cid) => cid !== data.id),
            }))
        );
        queryClient.setQueryData(
          subThemeKeys.list(data.review),
          (oldData: SubTheme[] = []) =>
            oldData.map((st) =>
              st.id === variables.payload.subTheme
                ? { ...st, codeIds: [...st.codeIds, data.id] }
                : st
            )
        );
      }
      applyUpdate(queryClient, codeKeys.list(data.review), data);
    },
    onError: onMutationError('update code'),
  });
}

export function useDeleteCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; reviewId: number }) => deleteCode(id),
    onSuccess: (_data, variables) => {
      // Remove code from its sub-theme's codeIds list
      queryClient.setQueryData(
        subThemeKeys.list(variables.reviewId),
        (oldData: SubTheme[] = []) =>
          oldData.map((st) => ({
            ...st,
            codeIds: st.codeIds.filter((cid) => cid !== variables.id),
          }))
      );
      applyDelete<Code>(
        queryClient,
        codeKeys.list(variables.reviewId),
        variables.id,
        'Code has been deleted.'
      );
    },
    onError: onMutationError('delete code'),
  });
}
