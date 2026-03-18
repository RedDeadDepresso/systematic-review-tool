import { errorMessageString } from '@/lib/error';
import {
  bulkSaveAnswers,
  deleteExtractionAnswer,
  fetchExtractionAnswers,
  saveExtractionAnswer,
} from '@/features/extraction/api/extraction-answers';
import type { ExtractionAnswer } from '@/features/extraction/types/extraction';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cacheRemove, onMutationError } from '@/lib/query-helpers';
import { extractionTableKeys } from '@/features/extraction/hooks/use-extraction-table';

export const extractionAnswerKeys = {
  list: (params: { referenceId?: number; questionId?: number }) =>
    ['extraction-answers', params] as const,
  byReference: (referenceId: number) =>
    ['extraction-answers', { referenceId }] as const,
};

/* ------------------ FETCH EXTRACTION ANSWERS ------------------ */
export const useFetchExtractionAnswers = ({
  referenceId,
  questionId,
}: {
  referenceId?: number;
  questionId?: number;
}) =>
  useQuery({
    queryKey: extractionAnswerKeys.list({ referenceId, questionId }),
    queryFn: () => fetchExtractionAnswers({ referenceId, questionId }),
  });

/* ------------------ SAVE EXTRACTION ANSWER ------------------ */
export const useSaveExtractionAnswer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveExtractionAnswer,
    onSuccess: (data, variables) => {
      toast.success('Answer saved.');
      // Upsert: replace if exists, otherwise append
      queryClient.setQueryData<ExtractionAnswer[]>(
        extractionAnswerKeys.list({
          referenceId: variables.reference,
          questionId: variables.question,
        }),
        (oldData = []) => {
          const exists = oldData.some(
            (a) =>
              a.reference === variables.reference &&
              a.question === variables.question
          );
          return exists
            ? oldData.map((a) =>
                a.reference === variables.reference &&
                a.question === variables.question
                  ? data
                  : a
              )
            : [...oldData, data];
        }
      );
      queryClient.invalidateQueries({
        queryKey: extractionAnswerKeys.byReference(variables.reference),
      });
    },
    onError: onMutationError('save answer'),
  });
};

/* ------------------ DELETE EXTRACTION ANSWER ------------------ */
export const useDeleteExtractionAnswer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      answerId,
    }: {
      answerId: number;
      referenceId: number;
      questionId: number;
    }) => deleteExtractionAnswer(answerId),
    onSuccess: (_data, variables) => {
      toast.success('Answer deleted.');
      queryClient.setQueryData<ExtractionAnswer[]>(
        extractionAnswerKeys.list({
          referenceId: variables.referenceId,
          questionId: variables.questionId,
        }),
        cacheRemove(variables.answerId)
      );
      queryClient.invalidateQueries({
        queryKey: extractionAnswerKeys.byReference(variables.referenceId),
      });
    },
    onError: onMutationError('delete answer'),
  });
};

/* ------------------ BULK SAVE ANSWERS ------------------ */
export const useBulkSaveAnswers = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkSaveAnswers,
    onSuccess: (data, variables) => {
      toast.success(`${data.savedCount} answer(s) saved.`);
      queryClient.invalidateQueries({
        queryKey: extractionAnswerKeys.byReference(variables.referenceId),
      });
      queryClient.invalidateQueries({ queryKey: extractionTableKeys.all });
    },
    onError: (error: any) => {
      toast.error(`Failed to save answers: ${errorMessageString(error)}`);
    },
  });
};
