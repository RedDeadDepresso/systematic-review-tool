import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchExtractionTableData,
  batchUpdateAnswers,
  saveExtractionAnswer,
  downloadCSVFile,
  bulkUpdateExtractionStatus,
} from '@/features/extraction/api/extraction-table';
import { onMutationError } from '@/lib/query-helpers';

export const extractionTableKeys = {
  all: ['extraction-table'] as const,
  detail: (reviewId: number) => ['extraction-table', reviewId] as const,
};

export const useFetchExtractionTableData = (reviewId: number) =>
  useQuery({
    queryKey: extractionTableKeys.detail(reviewId),
    queryFn: () => fetchExtractionTableData(reviewId),
    staleTime: 30_000,
  });

export const useBatchUpdateAnswers = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: batchUpdateAnswers,
    onSuccess: (_, variables) => {
      toast.success(`${variables.length} answer(s) saved.`);
      queryClient.invalidateQueries({ queryKey: extractionTableKeys.all });
    },
    onError: onMutationError('save answers'),
  });
};

export const useSaveExtractionAnswer = () =>
  useMutation({
    mutationFn: saveExtractionAnswer,
    onError: onMutationError('save answer'),
  });

export const useDownloadCSVFile = () =>
  useMutation({
    mutationFn: downloadCSVFile,
    onSuccess: () => toast.success('CSV exported successfully.'),
    onError: onMutationError('export CSV'),
  });

export const useBulkUpdateExtractionStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkUpdateExtractionStatus,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: extractionTableKeys.all });
      const previousData = queryClient.getQueryData(extractionTableKeys.all);

      queryClient.setQueriesData(
        { queryKey: extractionTableKeys.all },
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            references: old.references.map((ref: any) =>
              variables.referenceIds.includes(ref.id)
                ? {
                    ...ref,
                    isExtractionCompleted: variables.isExtractionCompleted,
                  }
                : ref
            ),
          };
        }
      );

      return { previousData };
    },
    onSuccess: (data, variables) => {
      const action = variables.isExtractionCompleted
        ? 'completed'
        : 'incomplete';
      toast.success(`${data.updatedCount} reference(s) marked as ${action}.`);
    },
    onError: (error: any, __, context) => {
      queryClient.setQueryData(extractionTableKeys.all, context?.previousData);
      toast.error(
        `Failed to update extraction status: ${error?.message ?? error}`
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: extractionTableKeys.all });
    },
  });
};
