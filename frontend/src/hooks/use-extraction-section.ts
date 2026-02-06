import {
  createExtractionSection,
  deleteExtractionSection,
  fetchExtractionSections,
  updateExtractionSection,
} from '@/api/extraction-section';
import type { ExtractionSection } from '@/types/extraction';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/* ------------------ FETCH EXTRACTION SECTIONS ------------------ */
export const useFetchExtractionSections = ({
  reviewId,
}: {
  reviewId: number;
}) => {
  return useQuery({
    queryKey: ['reviews', reviewId, 'extraction-sections'],
    queryFn: () => fetchExtractionSections({ reviewId }),
  });
};

/* ------------------ CREATE EXTRACTION SECTION ------------------ */
export const useCreateExtractionSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExtractionSection,
    onSuccess: (data, variables) => {
      toast.success('Extraction section created.');
      queryClient.setQueryData(
        ['reviews', variables.review, 'extraction-sections'],
        (oldData: ExtractionSection[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
    onError: () => {
      toast.error('Failed to create extraction section.');
    },
  });
};

/* ------------------ UPDATE EXTRACTION SECTION ------------------ */
export const useUpdateExtractionSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sectionId,
      payload,
    }: {
      sectionId: number;
      reviewId: number;
      payload: {
        name?: string;
        order?: number;
      };
    }) => updateExtractionSection(sectionId, payload),
    onSuccess: (data, variables) => {
      toast.success('Extraction section updated.');
      queryClient.setQueryData(
        ['reviews', variables.reviewId, 'extraction-sections'],
        (oldData: ExtractionSection[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map((section) =>
            section.id === variables.sectionId ? data : section
          );
        }
      );
    },
    onError: () => {
      toast.error('Failed to update extraction section.');
    },
  });
};

/* ------------------ DELETE EXTRACTION SECTION ------------------ */
export const useDeleteExtractionSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId }: { sectionId: number; reviewId: number }) =>
      deleteExtractionSection(sectionId),
    onSuccess: (_data, variables) => {
      toast.success('Extraction section deleted.');
      queryClient.setQueryData(
        ['reviews', variables.reviewId, 'extraction-sections'],
        (oldData: ExtractionSection[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.filter(
            (section) => section.id !== variables.sectionId
          );
        }
      );
    },
    onError: () => {
      toast.error('Failed to delete extraction section.');
    },
  });
};
