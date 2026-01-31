import { useState, useCallback, useMemo } from 'react';
import { useFetchUploadedPDFs, useUploadPDF } from '@/hooks/use-uploaded-pdf';
import { useAttachPDFsToReferences } from './use-reference';
import { useDetectDuplicateReferences } from '@/hooks/use-reference-duplicate';
import { useUploadReviewReferences } from '@/hooks/use-review';
import type { ReferencePDFMapping } from '@/types/reference';

export function useFileUpload(
  reviewId: number,
  onSuccess: () => void,
  selectedReferenceIds: number[] = [],
  highlightedReferenceId: number | null = null,
  references: any[] = []
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
        setOpenMatchDialog(true);
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
