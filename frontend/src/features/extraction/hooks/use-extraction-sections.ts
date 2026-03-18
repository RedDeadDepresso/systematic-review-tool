import {
  createExtractionSection,
  deleteExtractionSection,
  fetchExtractionFormData,
  fetchExtractionSections,
  updateExtractionSection,
} from '@/features/extraction/api/extraction-sections';
import type { ExtractionSection } from '@/features/extraction/types/extraction';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyCreate,
  applyDelete,
  applyUpdate,
  onMutationError,
} from '@/lib/query-helpers';

export const extractionSectionKeys = {
  list: (reviewId: number) =>
    ['reviews', reviewId, 'extraction-sections'] as const,
  formData: (referenceId: number, reviewId: number) =>
    ['extraction-form-data', referenceId, reviewId] as const,
};

export const useFetchExtractionSections = ({
  reviewId,
}: {
  reviewId: number;
}) =>
  useQuery({
    queryKey: extractionSectionKeys.list(reviewId),
    queryFn: () => fetchExtractionSections({ reviewId }),
  });

export const useFetchExtractionFormData = ({
  referenceId,
  reviewId,
  isOpen,
}: {
  referenceId: number;
  reviewId: number;
  isOpen: boolean;
}) =>
  useQuery({
    queryKey: extractionSectionKeys.formData(referenceId, reviewId),
    queryFn: () => fetchExtractionFormData(referenceId, reviewId),
    enabled: isOpen && !!referenceId && !!reviewId,
  });

export const useCreateExtractionSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExtractionSection,
    onSuccess: (data, variables) =>
      applyCreate(
        queryClient,
        extractionSectionKeys.list(variables.review),
        data,
        'Extraction section created.'
      ),
    onError: onMutationError('create extraction section'),
  });
};

export const useUpdateExtractionSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sectionId,
      payload,
    }: {
      sectionId: number;
      reviewId: number;
      payload: { name?: string; order?: number };
    }) => updateExtractionSection(sectionId, payload),
    onSuccess: (data, variables) =>
      applyUpdate(
        queryClient,
        extractionSectionKeys.list(variables.reviewId),
        data,
        'Extraction section updated.'
      ),
    onError: onMutationError('update extraction section'),
  });
};

export const useDeleteExtractionSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId }: { sectionId: number; reviewId: number }) =>
      deleteExtractionSection(sectionId),
    onSuccess: (_data, variables) =>
      applyDelete<ExtractionSection>(
        queryClient,
        extractionSectionKeys.list(variables.reviewId),
        variables.sectionId,
        'Extraction section deleted.'
      ),
    onError: onMutationError('delete extraction section'),
  });
};
