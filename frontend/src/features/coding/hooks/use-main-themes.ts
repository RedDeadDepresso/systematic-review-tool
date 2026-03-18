import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMainTheme,
  deleteMainTheme,
  fetchMainThemes,
  updateMainTheme,
} from '@/features/coding/api/main-themes';
import type { MainTheme } from '@/features/coding/types/main-themes';
import {
  applyCreate,
  applyDelete,
  applyUpdate,
  onMutationError,
} from '@/lib/query-helpers';

export const mainThemeKeys = {
  list: (reviewId: number) => ['reviews', reviewId, 'main-themes'] as const,
};

export function useFetchMainThemes(reviewId: number) {
  return useQuery({
    queryKey: mainThemeKeys.list(reviewId),
    queryFn: () => fetchMainThemes(reviewId),
    enabled: !!reviewId,
  });
}

export function useCreateMainTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMainTheme,
    onSuccess: (data, variables) =>
      applyCreate(
        queryClient,
        mainThemeKeys.list(variables.review),
        data,
        'Main Theme has been created.'
      ),
    onError: onMutationError('create main theme'),
  });
}

export function useUpdateMainTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMainTheme,
    onSuccess: (data) =>
      applyUpdate(
        queryClient,
        mainThemeKeys.list(data.review),
        data,
        'MainTheme has been updated.'
      ),
    onError: onMutationError('update main theme'),
  });
}

export function useDeleteMainTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; reviewId: number }) =>
      deleteMainTheme(id),
    onSuccess: (_data, variables) =>
      applyDelete<MainTheme>(
        queryClient,
        mainThemeKeys.list(variables.reviewId),
        variables.id,
        'MainTheme has been deleted.'
      ),
    onError: onMutationError('delete main theme'),
  });
}
