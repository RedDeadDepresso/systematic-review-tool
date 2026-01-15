import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createMainTheme, fetchMainThemes } from '@/api/main-theme';
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
