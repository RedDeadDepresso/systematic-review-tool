import {
  createExtractionQuestion,
  deleteExtractionQuestion,
  fetchExtractionQuestions,
  updateExtractionQuestion,
} from '@/api/extraction-question';
import type { ExtractionQuestion, QuestionType } from '@/types/extraction';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/* ------------------ FETCH EXTRACTION QUESTIONS ------------------ */
export const useFetchExtractionQuestions = ({
  reviewId,
  sectionId,
  type,
}: {
  reviewId: number;
  sectionId?: number;
  type?: QuestionType[];
}) => {
  return useQuery({
    queryKey: ['extraction-questions', reviewId, sectionId, type],
    queryFn: () => fetchExtractionQuestions({ reviewId, sectionId, type }),
    enabled: !!reviewId,
  });
};

/* ------------------ CREATE EXTRACTION QUESTION ------------------ */
export const useCreateExtractionQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExtractionQuestion,
    onSuccess: (data, variables) => {
      toast.success('Question created.');
      queryClient.setQueryData(
        ['extraction-sections', variables.section, 'questions'],
        (oldData: ExtractionQuestion[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
      // Also invalidate the general questions query
      queryClient.invalidateQueries({ queryKey: ['extraction-questions'] });
    },
    onError: () => {
      toast.error('Failed to create question.');
    },
  });
};

/* ------------------ UPDATE EXTRACTION QUESTION ------------------ */
export const useUpdateExtractionQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      payload,
    }: {
      questionId: number;
      payload: {
        section?: number;
        question?: string;
        columnTitle?: string;
        type?:
          | 'free-text'
          | 'number'
          | 'date'
          | 'single-select'
          | 'multi-select'
          | 'boolean';
        options?: string[];
        required?: boolean;
        order?: number;
      };
    }) => updateExtractionQuestion(questionId, payload),
    onSuccess: (data, variables) => {
      toast.success('Question updated.');
      queryClient.setQueryData(
        ['extraction-sections', variables.payload.section, 'questions'],
        (oldData: ExtractionQuestion[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map((question) =>
            question.id === variables.questionId ? data : question
          );
        }
      );
      queryClient.invalidateQueries({ queryKey: ['extraction-questions'] });
    },
    onError: () => {
      toast.error('Failed to update question.');
    },
  });
};

/* ------------------ DELETE EXTRACTION QUESTION ------------------ */
export const useDeleteExtractionQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId }: { questionId: number; sectionId: number }) =>
      deleteExtractionQuestion(questionId),
    onSuccess: (_data, variables) => {
      toast.success('Question deleted.');
      queryClient.setQueryData(
        ['extraction-sections', variables.sectionId, 'questions'],
        (oldData: ExtractionQuestion[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.filter(
            (question) => question.id !== variables.questionId
          );
        }
      );
      queryClient.invalidateQueries({ queryKey: ['extraction-questions'] });
    },
    onError: () => {
      toast.error('Failed to delete question.');
    },
  });
};
