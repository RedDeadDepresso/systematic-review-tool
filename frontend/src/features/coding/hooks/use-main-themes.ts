import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createMainTheme,
  deleteMainTheme,
  fetchMainThemes,
  updateMainTheme,
} from '@/features/coding/api/main-themes';
import type { MainTheme } from '@/features/coding/types/main-themes';
import { errorMessageString } from '@/lib/error';

export function useFetchMainThemes(reviewId: number) {
  return useQuery({
    queryKey: ['reviews', reviewId, 'main-themes'],
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
        ['reviews', variables.review, 'main-themes'],
        (oldData: MainTheme[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
    onError: (error: any) => {
      toast.error(`Failed to create main theme: ${errorMessageString(error)}`);
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
        ['reviews', data.review, 'main-themes'],
        (oldData: MainTheme[] = []) =>
          oldData.map((theme) => (theme.id === data.id ? data : theme))
      );
    },
    onError: (error: any) => {
      toast.error(`Failed to update main theme: ${errorMessageString(error)}`);
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
        ['reviews', variables.reviewId, 'main-themes'],
        (oldData = []) => oldData.filter((theme) => theme.id !== variables.id)
      );
    },
    onError: (error: any) => {
      toast.error(`Failed to delete main theme: ${errorMessageString(error)}`);
    },
  });
}
