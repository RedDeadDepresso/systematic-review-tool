import { bulkUpsertReferenceOpinions } from '@/api/reference-opinion';
import type { OpinionStatus, Stage } from '@/types/reference';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useBulkUpsertReferenceOpinions = () => {
  return useMutation({
    mutationFn: async ({
      payload,
    }: {
      payload: {
        referenceIds: number[];
        status: OpinionStatus;
        stage: Stage;
      };
    }) => {
      return bulkUpsertReferenceOpinions(payload);
    },
    onError: () => {
      toast.error('Failed to update reference.');
    },
  });
};
