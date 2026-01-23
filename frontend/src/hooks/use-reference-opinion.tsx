import { updateReferenceOpinion } from '@/api/reference-opinion';
import type { Reference } from '@/types/reference';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useUpdateReferenceOpinion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      referenceId,
      payload,
    }: {
      reviewId: number;
      referenceId: number;
      payload: { status: 'Undecided' | 'Excluded' | 'Maybe' | 'Included' };
    }) => {
      // Adapt the variables to the expected shape for updateReferenceOpinion
      return updateReferenceOpinion({
        reference: referenceId,
        status: payload.status,
      });
    },
    onSuccess: (
      data: {
        reviewer: string;
        status: string;
      },
      variables: {
        reviewId: number;
        referenceId: number;
        payload: { status: 'Undecided' | 'Excluded' | 'Maybe' | 'Included' };
      }
    ) => {
      const { reviewer, status } = data;
      const { reviewId, referenceId } = variables;
      queryClient.setQueryData(
        ['reviews', reviewId, 'references'],
        (old: Reference[] | undefined) => {
          if (!old) return old;

          return old.map((ref) => {
            if (ref.id !== referenceId) return ref;

            // Normalize opinions to array
            const opinions = Array.isArray(ref.opinions) ? ref.opinions : [];

            // Remove any existing opinion from the same reviewer
            const updatedOpinions = [
              ...opinions.filter((op) => op.reviewer !== reviewer),
              { reviewer, status },
            ];

            return {
              ...ref,
              opinions: updatedOpinions,
            };
          });
        }
      );
    },
  });
};
