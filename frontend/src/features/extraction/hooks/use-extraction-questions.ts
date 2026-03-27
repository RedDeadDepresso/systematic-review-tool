import {
  createExtractionQuestion,
  deleteExtractionQuestion,
  fetchExtractionQuestions,
  updateExtractionQuestion,
} from '@/features/extraction/api/extraction-questions';
import type {
  ExtractionQuestion,
  QuestionType,
} from '@/features/extraction/types/extraction';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyCreate,
  applyDelete,
  applyUpdate,
  onMutationError,
} from '@/lib/query-helpers';

export const extractionQuestionKeys = {
  all: ['extraction-questions'] as const,
  list: (reviewId: number, sectionId?: number, type?: QuestionType[]) =>
    ['extraction-questions', reviewId, sectionId, type] as const,
  bySection: (sectionId: number) =>
    ['extraction-sections', sectionId, 'questions'] as const,
};

/* ------------------ FETCH EXTRACTION QUESTIONS ------------------ */
export const useFetchExtractionQuestions = ({
  reviewId,
  sectionId,
  type,
}: {
  reviewId: number;
  sectionId?: number;
  type?: QuestionType[];
}) =>
  useQuery({
    queryKey: extractionQuestionKeys.list(reviewId, sectionId, type),
    queryFn: () => fetchExtractionQuestions({ reviewId, sectionId, type }),
    enabled: !!reviewId,
  });

/* ------------------ CREATE EXTRACTION QUESTION ------------------ */
export const useCreateExtractionQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExtractionQuestion,
    onSuccess: (data, variables) => {
      applyCreate(
        queryClient,
        extractionQuestionKeys.bySection(variables.section),
        data,
        'Question created.'
      );
      queryClient.invalidateQueries({ queryKey: extractionQuestionKeys.all });
    },
    onError: onMutationError('create question'),
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
      applyUpdate(
        queryClient,
        extractionQuestionKeys.bySection(variables.payload.section!),
        data,
        'Question updated.'
      );
      queryClient.invalidateQueries({ queryKey: extractionQuestionKeys.all });
    },
    onError: onMutationError('update question'),
  });
};

/* ------------------ DELETE EXTRACTION QUESTION ------------------ */
export const useDeleteExtractionQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId }: { questionId: number; sectionId: number }) =>
      deleteExtractionQuestion(questionId),
    onSuccess: (_data, variables) => {
      applyDelete<ExtractionQuestion>(
        queryClient,
        extractionQuestionKeys.bySection(variables.sectionId),
        variables.questionId,
        'Question deleted.'
      );
      queryClient.invalidateQueries({ queryKey: extractionQuestionKeys.all });
    },
    onError: onMutationError('delete question'),
  });
};
