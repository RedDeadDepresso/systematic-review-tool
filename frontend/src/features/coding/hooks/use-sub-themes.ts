import {
  createSubTheme,
  deleteSubTheme,
  fetchSubThemes,
  updateSubTheme,
} from '@/features/coding/api/sub-themes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SubTheme } from '@/features/coding/types/sub-themes';
import type { MainTheme } from '@/features/coding/types/main-themes';
import {
  applyCreate,
  applyDelete,
  applyUpdate,
  onMutationError,
} from '@/lib/query-helpers';
import { mainThemeKeys } from '@/features/coding/hooks/use-main-themes';

export const subThemeKeys = {
  list: (reviewId: number) => ['reviews', reviewId, 'sub-themes'] as const,
};

export function useFetchSubThemes(reviewId: number) {
  return useQuery({
    queryKey: subThemeKeys.list(reviewId),
    queryFn: () => fetchSubThemes(reviewId),
    enabled: !!reviewId,
  });
}

export function useCreateSubTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSubTheme,
    onSuccess: (data, variables) =>
      applyCreate(
        queryClient,
        subThemeKeys.list(variables.review),
        data,
        'SubTheme has been created.'
      ),
    onError: onMutationError('create sub theme'),
  });
}

export function useUpdateSubTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSubTheme,
    onSuccess: (data, variables) => {
      toast.success('SubTheme has been updated.');
      // Re-assign the sub-theme to its new main theme if it changed
      if (variables.payload?.mainTheme !== undefined) {
        queryClient.setQueryData(
          mainThemeKeys.list(data.review),
          (oldData: MainTheme[] = []) =>
            oldData.map((mt) => ({
              ...mt,
              subThemeIds: mt.subThemeIds.filter((id) => id !== data.id),
            }))
        );
        queryClient.setQueryData(
          mainThemeKeys.list(data.review),
          (oldData: MainTheme[] = []) =>
            oldData.map((mt) =>
              mt.id === variables.payload.mainTheme
                ? { ...mt, subThemeIds: [...mt.subThemeIds, data.id] }
                : mt
            )
        );
      }
      applyUpdate(queryClient, subThemeKeys.list(data.review), data);
    },
    onError: onMutationError('update sub theme'),
  });
}

export function useDeleteSubTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; reviewId: number }) =>
      deleteSubTheme(id),
    onSuccess: (_data, variables) => {
      // Remove sub-theme from its main theme's subThemeIds list
      queryClient.setQueryData(
        mainThemeKeys.list(variables.reviewId),
        (oldData: MainTheme[] = []) =>
          oldData.map((mt) => ({
            ...mt,
            subThemeIds: mt.subThemeIds.filter((id) => id !== variables.id),
          }))
      );
      applyDelete<SubTheme>(
        queryClient,
        subThemeKeys.list(variables.reviewId),
        variables.id,
        'SubTheme has been deleted.'
      );
    },
    onError: onMutationError('delete sub theme'),
  });
}
