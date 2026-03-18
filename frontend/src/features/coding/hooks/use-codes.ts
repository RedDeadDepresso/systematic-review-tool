import {
  createCode,
  deleteCode,
  fetchCodes,
  updateCode,
} from '@/features/coding/api/codes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Code } from '@/features/coding/types/codes';
import type { SubTheme } from '@/features/coding/types/sub-themes';
import { errorMessageString } from '@/lib/error';

export function useFetchCodes(reviewId: number) {
  return useQuery({
    queryKey: ['reviews', reviewId, 'codes'],
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
        ['reviews', variables.review, 'codes'],
        (oldData: Code[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
    onError: (error: any) => {
      toast.error(`Failed to create code: ${errorMessageString(error)}`);
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
          ['reviews', data.review, 'sub-themes'],
          (oldData: SubTheme[] = []) =>
            oldData.map((st) => ({
              ...st,
              codeIds: st.codeIds.filter((cid) => cid !== data.id),
            }))
        );
        queryClient.setQueryData(
          ['reviews', data.review, 'sub-themes'],
          (oldData: SubTheme[] = []) =>
            oldData.map((st) =>
              st.id === variables.payload.subTheme
                ? { ...st, codeIds: [...st.codeIds, data.id] }
                : st
            )
        );
      }
      queryClient.setQueryData(
        ['reviews', data.review, 'codes'],
        (oldData: Code[] = []) =>
          oldData.map((code) => (code.id === data.id ? data : code))
      );
    },
    onError: (error: any) => {
      toast.error(`Failed to update code: ${errorMessageString(error)}`);
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
        ['reviews', variables.reviewId, 'sub-themes'],
        (oldData: SubTheme[] = []) =>
          oldData.map((st) => ({
            ...st,
            codeIds: st.codeIds.filter((cid) => cid !== variables.id),
          }))
      );
      queryClient.setQueryData<Code[]>(
        ['reviews', variables.reviewId, 'codes'],
        (old = []) => old.filter((code) => code.id !== variables.id)
      );
    },
    onError: (error: any) => {
      toast.error(`Failed to delete code: ${errorMessageString(error)}`);
    },
  });
}
