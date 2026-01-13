import { createTheme, fetchThemes } from '@/api/theme';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Theme } from '@/types/theme';

export const useFetchThemes = ({ reviewId }: { reviewId: number }) => {
  return useQuery({
    queryKey: ['reviews', reviewId, 'themes'],
    queryFn: () => fetchThemes(reviewId),
  });
};

export const useCreateTheme = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ review, data }: { review: number; data: any }) =>
      createTheme(review, data),
    onSuccess: (data, variables) => {
      toast.success('Theme has been created.');
      queryClient.setQueryData(
        ['reviews', variables.review, 'themes'],
        (oldData: Theme[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
  });
};
