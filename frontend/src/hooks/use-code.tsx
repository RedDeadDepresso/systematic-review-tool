import { createCode, editCode, fetchCodes, fetchReviewCodes } from '@/api/code';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Code } from '@/types/code';

export const useFetchCodes = ({ referenceId }: { referenceId: number }) => {
  return useQuery({
    queryKey: ['references', referenceId, 'codes'],
    queryFn: () => fetchCodes(referenceId),
  });
};

export const useFetchReviewCodes = ({ reviewId }: { reviewId: number }) => {
  return useQuery({
    queryKey: ['reviews', reviewId, 'codes'],
    queryFn: () => fetchReviewCodes(reviewId),
  });
};

export const useCreateCode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reference, data }: { reference: number; data: any }) =>
      createCode(reference, data),
    onSuccess: (data, variables) => {
      toast.success('Code has been created.');
      queryClient.setQueryData(
        ['references', variables.reference, 'codes'],
        (oldData: Code[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
  });
};

export const useEditCode = () => {
  return useMutation({
    mutationFn: editCode,
  });
};
