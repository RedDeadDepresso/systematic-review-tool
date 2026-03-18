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
import { errorMessageString } from '@/lib/error';

export function useFetchSubThemes(reviewId: number) {
  return useQuery({
    queryKey: ['reviews', reviewId, 'sub-themes'],
    queryFn: () => fetchSubThemes(reviewId),
    enabled: !!reviewId,
  });
}

export function useCreateSubTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSubTheme,
    onSuccess: (data, variables) => {
      toast.success('SubTheme has been created.');
      queryClient.setQueryData(
        ['reviews', variables.review, 'sub-themes'],
        (oldData: SubTheme[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
    onError: (error: any) => {
      toast.error(`Failed to create sub theme: ${errorMessageString(error)}`);
    },
  });
}

export function useUpdateSubTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSubTheme,
    onSuccess: (data, variables) => {
      toast.success('SubTheme has been updated.');
      if (variables.payload?.mainTheme !== undefined) {
        queryClient.setQueryData(
          ['reviews', data.review, 'main-themes'],
          (oldData: MainTheme[] = []) =>
            oldData.map((mt) => ({
              ...mt,
              subThemeIds: mt.subThemeIds.filter((id) => id !== data.id),
            }))
        );
        queryClient.setQueryData(
          ['reviews', data.review, 'main-themes'],
          (oldData: MainTheme[] = []) =>
            oldData.map((mt) =>
              mt.id === variables.payload.mainTheme
                ? {
                    ...mt,
                    subThemeIds: [...mt.subThemeIds, data.id],
                  }
                : mt
            )
        );
      }
      queryClient.setQueryData(
        ['reviews', data.review, 'sub-themes'],
        (oldData: SubTheme[] = []) =>
          oldData.map((theme) => (theme.id === data.id ? data : theme))
      );
    },
    onError: (error: any) => {
      toast.error(`Failed to update sub theme: ${errorMessageString(error)}`);
    },
  });
}

export function useDeleteSubTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: number; reviewId: number }) =>
      deleteSubTheme(id),
    onSuccess: (_data, variables) => {
      toast.success('SubTheme has been deleted.');
      queryClient.setQueryData(
        ['reviews', variables.reviewId, 'main-themes'],
        (oldData: MainTheme[] = []) =>
          oldData.map((mt) => ({
            ...mt,
            subThemeIds: mt.subThemeIds.filter((id) => id !== variables.id),
          }))
      );
      queryClient.setQueryData<SubTheme[]>(
        ['reviews', variables.reviewId, 'sub-themes'],
        (oldData = []) => oldData.filter((theme) => theme.id !== variables.id)
      );
    },
    onError: (error: any) => {
      toast.error(`Failed to delete sub theme: ${errorMessageString(error)}`);
    },
  });
}
