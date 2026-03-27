import { errorMessageString } from '@/lib/error';
import { bulkUpsertReferenceOpinions } from '@/features/references/api/reference-opinions';
import type {
  OpinionStatus,
  Stage,
} from '@/features/references/types/references';
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
        reason?: number | null;
      };
    }) => {
      return bulkUpsertReferenceOpinions(payload);
    },
    onError: (error: any) => {
      toast.error(
        `Failed to update reference opinions: ${errorMessageString(error)}`
      );
    },
  });
};
