import { useState, useCallback, useMemo } from 'react';
import {
  useFetchUploadedPDFs,
  useUploadPDF,
} from '@/features/references/hooks/use-uploaded-pdfs';
import { useAttachPDFsToReferences } from '@/features/references/hooks/use-references';
import { useDetectDuplicateReferences } from '@/features/references/hooks/use-reference-duplicates';
import { useUploadReviewReferences } from '@/features/reviews/hooks/use-reviews';
import type {
  Reference,
  ReferencePDFMapping,
} from '@/features/references/types/references';

export function useFileUpload(
  reviewId: number,
  onSuccess: () => void,
  selectedReferenceIds: number[] = [],
  highlightedReferenceId: number | null = null,
  references: Reference[] = []
) {
  const [openUploadBibDialog, setOpenUploadBibDialog] = useState(false);
  const [openUploadPDFDialog, setOpenUploadPDFDialog] = useState(false);
  const [openMatchDialog, setOpenMatchDialog] = useState(false);

  const usefetchUploadedPDFs = useFetchUploadedPDFs(reviewId);
  const uploadPDF = useUploadPDF();
  const attachPDFsToReferences = useAttachPDFsToReferences();
  const detectDuplicateReferences = useDetectDuplicateReferences();
  const uploadReviewReferences = useUploadReviewReferences();

  const handleUploadPDF = useCallback(
    async (file: File): Promise<boolean> => {
      try {
        await uploadPDF.mutateAsync({
          file,
          review: reviewId,
        });
        return true;
      } catch (error) {
        return false;
      }
    },
    [uploadPDF, reviewId]
  );

  const handleUploadReferences = useCallback(
    async (file: File): Promise<boolean> => {
      const formData = new FormData();
      formData.append('file', file);

      try {
        await uploadReviewReferences.mutateAsync({
          reviewId,
          formData,
        });
        onSuccess();
        return true;
      } catch (error) {
        return false;
      }
    },
    [uploadReviewReferences, reviewId, onSuccess]
  );

  const handleMatch = useCallback(
    async (mappings: ReferencePDFMapping[]): Promise<boolean> => {
      try {
        await attachPDFsToReferences.mutateAsync({ reviewId, mappings });
        setOpenMatchDialog(false);
        onSuccess();
        return true;
      } catch (error) {
        return false;
      }
    },
    [attachPDFsToReferences, reviewId, onSuccess]
  );

  const combinedReferences = useMemo(() => {
    if (!openMatchDialog || !references) return [];

    return references
      .filter(
        (ref) =>
          selectedReferenceIds.includes(ref.id) ||
          ref.id === highlightedReferenceId
      )
      .map((ref) => ({
        ...ref,
        isSelected: selectedReferenceIds.includes(ref.id),
        isHighlighted: ref.id === highlightedReferenceId,
      }));
  }, [
    openMatchDialog,
    references,
    selectedReferenceIds,
    highlightedReferenceId,
  ]);

  return {
    openUploadBibDialog,
    setOpenUploadBibDialog,
    openUploadPDFDialog,
    setOpenUploadPDFDialog,
    openMatchDialog,
    setOpenMatchDialog,
    uploadedPDFs: usefetchUploadedPDFs.data || [],
    handleUploadPDF,
    handleUploadReferences,
    handleMatch,
    combinedReferences,
    detectDuplicateReferences,
  };
}
