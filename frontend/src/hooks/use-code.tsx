import { createCode, deleteCode, fetchCodes, updateCode } from '@/api/code';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Code } from '@/types/code';

export function useFetchCodes(reviewId: number) {
  return useQuery({
    queryKey: ['codes', reviewId],
    queryFn: () => fetchCodes(reviewId),
    enabled: !!reviewId,
  });
}

export function useCreateCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCode,
    onSuccess: (data, variables) => {
      toast.success('Code has been created.');
      queryClient.setQueryData(
        ['codes', variables.review],
        (oldData: Code[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
  });
}

export function useUpdateCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCode,
    onSuccess: (data) => {
      toast.success('Code has been updated.');
      queryClient.setQueryData(
        ['codes', data.review],
        (oldData: Code[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
  });
}

// Hook for deleting a code
export function useDeleteCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reviewId }: { id: string; reviewId: number }) =>
      deleteCode(id),
    onSuccess: (_data, variables) => {
      toast.success('Code has been deleted.');
      queryClient.setQueryData<Code[]>(
        ['codes', variables.reviewId],
        (old = []) => old.filter((code) => code.id !== variables.id)
      );
    },
  });
}
