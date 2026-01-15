import { createSubTheme, fetchSubThemes } from '@/api/sub-theme';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SubTheme } from '@/types/sub-theme';

export function useFetchSubThemes(reviewId: number) {
  return useQuery({
    queryKey: ['sub-themes', reviewId],
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
        ['sub-themes', variables.review],
        (oldData: SubTheme[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
  });
}
