import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchExtractionTableData,
  batchUpdateAnswers,
  saveExtractionAnswer,
  downloadCSVFile,
  bulkUpdateExtractionStatus,
} from '@/api/extraction-table';

/* ------------------ FETCH TABLE DATA ------------------ */
export const useFetchExtractionTableData = (reviewId: number) => {
  return useQuery({
    queryKey: ['extraction-table', reviewId],
    queryFn: () => fetchExtractionTableData(reviewId),
    staleTime: 30000, // 30 seconds
  });
};

/* ------------------ BATCH UPDATE ANSWERS ------------------ */
export const useBatchUpdateAnswers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: batchUpdateAnswers,
    onSuccess: (_, variables) => {
      toast.success(`${variables.length} answer(s) saved.`);
      // Invalidate table data to refetch
      queryClient.invalidateQueries({ queryKey: ['extraction-table'] });
    },
    onError: () => {
      toast.error('Failed to save answers.');
    },
  });
};

/* ------------------ SINGLE ANSWER UPDATE ------------------ */
export const useSaveExtractionAnswer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveExtractionAnswer,
    onMutate: async (newAnswer) => {
      // Get the review_id from the current query (you'll need to pass this)
      const queryKey = ['extraction-table'];

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically update
      queryClient.setQueriesData({ queryKey }, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          references: old.references.map((ref: any) => {
            if (ref.id === newAnswer.reference) {
              return {
                ...ref,
                answers: {
                  ...ref.answers,
                  [newAnswer.question]: {
                    id: ref.answers[newAnswer.question]?.id || 0,
                    value: newAnswer.value,
                  },
                },
              };
            }
            return ref;
          }),
        };
      });

      return { previousData };
    },
    onError: (err, newAnswer, context) => {
      // Rollback on error
      queryClient.setQueryData(['extraction-table'], context?.previousData);
      toast.error('Failed to save answer.');
    },
    onSettled: () => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['extraction-table'] });
    },
  });
};

/* ------------------ EXPORT CSV ------------------ */
export const useDownloadCSVFile = () => {
  return useMutation({
    mutationFn: downloadCSVFile,
    onSuccess: () => {
      toast.success('CSV exported successfully.');
    },
    onError: () => {
      toast.error('Failed to export CSV.');
    },
  });
};

/* ------------------ BULK UPDATE EXTRACTION STATUS ------------------ */
export const useBulkUpdateExtractionStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkUpdateExtractionStatus,
    onMutate: async (variables) => {
      const queryKey = ['extraction-table'];

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically update
      queryClient.setQueriesData({ queryKey }, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          references: old.references.map((ref: any) => {
            if (variables.referenceIds.includes(ref.id)) {
              return {
                ...ref,
                isExtractionCompleted: variables.isExtractionCompleted,
              };
            }
            return ref;
          }),
        };
      });

      return { previousData };
    },
    onSuccess: (data, variables) => {
      const action = variables.isExtractionCompleted
        ? 'completed'
        : 'incomplete';
      toast.success(`${data.updatedCount} reference(s) marked as ${action}.`);
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['extraction-table'], context?.previousData);
      toast.error('Failed to update extraction status.');
    },
    onSettled: () => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['extraction-table'] });
    },
  });
};
