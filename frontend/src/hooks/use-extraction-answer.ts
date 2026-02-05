import {
  deleteExtractionAnswer,
  fetchExtractionAnswers,
  saveExtractionAnswer,
} from '@/api/extraction-answer';
import type { ExtractionAnswer } from '@/types/extraction';
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
    onError: () => {
      toast.error('Failed to save answer.');
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
    onError: () => {
      toast.error('Failed to delete answer.');
    },
  });
};
