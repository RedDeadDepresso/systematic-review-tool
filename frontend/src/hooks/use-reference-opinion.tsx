import { updateReferenceOpinion } from '@/api/reference-opinion';
import type { OpinionStatus } from '@/types/reference';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useUpdateReferenceOpinion = () => {
  return useMutation({
    mutationFn: async ({
      payload,
    }: {
      payload: {
        referenceIds: number[];
        status: OpinionStatus;
      };
    }) => {
      return updateReferenceOpinion(payload);
    },
    onError: () => {
      toast.error('Failed to update reference.');
    },
  });
};
