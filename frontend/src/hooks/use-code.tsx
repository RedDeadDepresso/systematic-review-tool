import { createCode, deleteCode, fetchCodes, updateCode } from '@/api/code';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Code } from '@/types/code';
import type { SubTheme } from '@/types/sub-theme';

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
    onSuccess: (data, variables) => {
      toast.success('Code has been updated.');
      if (variables.payload.subTheme !== undefined) {
        queryClient.setQueryData(
          ['sub-themes', data.review],
          (oldData: SubTheme[] = []) =>
            oldData.map((st) => ({
              ...st,
              codeIds: st.codeIds.filter((cid) => cid !== data.id),
            }))
        );
        queryClient.setQueryData(
          ['sub-themes', data.review],
          (oldData: SubTheme[] = []) =>
            oldData.map((st) =>
              st.id === variables.payload.subTheme
                ? { ...st, codeIds: [...st.codeIds, data.id] }
                : st
            )
        );
      }
      queryClient.setQueryData(['codes', data.review], (oldData: Code[] = []) =>
        oldData.map((code) => (code.id === data.id ? data : code))
      );
    },
  });
}

// Hook for deleting a code
export function useDeleteCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; reviewId: number }) => deleteCode(id),
    onSuccess: (_data, variables) => {
      toast.success('Code has been deleted.');
      queryClient.setQueryData(
        ['sub-themes', variables.reviewId],
        (oldData: SubTheme[] = []) =>
          oldData.map((st) => ({
            ...st,
            codeIds: st.codeIds.filter((cid) => cid !== variables.id),
          }))
      );
      queryClient.setQueryData<Code[]>(
        ['codes', variables.reviewId],
        (old = []) => old.filter((code) => code.id !== variables.id)
      );
    },
  });
}
