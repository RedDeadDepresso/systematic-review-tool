import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createMainTheme,
  deleteMainTheme,
  fetchMainThemes,
  updateMainTheme,
} from '@/api/main-theme';
import type { MainTheme } from '@/types/main-theme';

export function useFetchMainThemes(reviewId: number) {
  return useQuery({
    queryKey: ['main-themes', reviewId],
    queryFn: () => fetchMainThemes(reviewId),
    enabled: !!reviewId,
  });
}

export function useCreateMainTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMainTheme,
    onSuccess: (data, variables) => {
      toast.success('Main Theme has been created.');
      queryClient.setQueryData(
        ['main-themes', variables.review],
        (oldData: MainTheme[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
  });
}

export function useUpdateMainTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMainTheme,
    onSuccess: (data) => {
      toast.success('MainTheme has been updated.');
      queryClient.setQueryData(
        ['main-themes', data.review],
        (oldData: MainTheme[] = []) =>
          oldData.map((theme) => (theme.id === data.id ? data : theme))
      );
    },
  });
}

export function useDeleteMainTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: number; reviewId: number }) =>
      deleteMainTheme(id),
    onSuccess: (_data, variables) => {
      toast.success('MainTheme has been deleted.');
      queryClient.setQueryData<MainTheme[]>(
        ['main-themes', variables.reviewId],
        (oldData = []) => oldData.filter((theme) => theme.id !== variables.id)
      );
    },
  });
}
