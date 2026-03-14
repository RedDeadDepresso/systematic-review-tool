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

/* ------------------ FETCH EXTRACTION ANSWERS ------------------ */
export const useFetchExtractionAnswers = ({
  referenceId,
  questionId,
}: {
  referenceId?: number;
  questionId?: number;
}) => {
  return useQuery({
    queryKey: ['extraction-answers', { referenceId, questionId }],
    queryFn: () => fetchExtractionAnswers({ referenceId, questionId }),
  });
};

/* ------------------ SAVE EXTRACTION ANSWER ------------------ */
export const useSaveExtractionAnswer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveExtractionAnswer,
    onSuccess: (data, variables) => {
      toast.success('Answer saved.');

      // Update cache for this specific reference-question pair
      queryClient.setQueryData(
        [
          'extraction-answers',
          { referenceId: variables.reference, questionId: variables.question },
        ],
        (oldData: ExtractionAnswer[] = []) => {
          const exists = oldData.find(
            (answer) =>
              answer.reference === variables.reference &&
              answer.question === variables.question
          );
          if (exists) {
            return oldData.map((answer) =>
              answer.reference === variables.reference &&
              answer.question === variables.question
                ? data
                : answer
            );
          }
          return [...oldData, data];
        }
      );

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['extraction-answers', { referenceId: variables.reference }],
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to save answer: ${errorMessageString(error)}.`);
    },
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
      queryClient.setQueryData(
        [
          'extraction-answers',
          {
            referenceId: variables.referenceId,
            questionId: variables.questionId,
          },
        ],
        (oldData: ExtractionAnswer[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.filter((answer) => answer.id !== variables.answerId);
        }
      );
      queryClient.invalidateQueries({
        queryKey: [
          'extraction-answers',
          { referenceId: variables.referenceId },
        ],
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to delete answer: ${errorMessageString(error)}.`);
    },
  });
};

export const useBulkSaveAnswers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkSaveAnswers,
    onSuccess: (data, variables) => {
      toast.success(`${data.savedCount} answer(s) saved.`);

      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: [
          'extraction-answers',
          { referenceId: variables.referenceId },
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ['extraction-table'],
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to save answers: ${errorMessageString(error)}.`);
    },
  });
};
