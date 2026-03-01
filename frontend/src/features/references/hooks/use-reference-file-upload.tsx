import { useState, useCallback, useMemo } from 'react';
import {
  useFetchUploadedPDFs,
  useUploadPDF,
} from '@/features/references/hooks/use-uploaded-pdfs';
import {
  useAttachPDFsToReferences,
  useAutoMatch,
} from '@/features/references/hooks/use-references';
import { useDetectDuplicateReferences } from '@/features/reviews/hooks/use-reviews';
import { useUploadReviewReferences } from '@/features/reviews/hooks/use-reviews';
import type {
  Reference,
  ReferencePDFMapping,
} from '@/features/references/types/references';
import { useQueryClient } from '@tanstack/react-query';

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
  const [openSavedPDFDialog, setopenSavedPDFDialog] = useState(false);

  const usefetchUploadedPDFs = useFetchUploadedPDFs(reviewId);
  const uploadPDF = useUploadPDF();
  const attachPDFsToReferences = useAttachPDFsToReferences();
  const detectDuplicateReferences = useDetectDuplicateReferences();
  const uploadReviewReferences = useUploadReviewReferences();
  const autoMatch = useAutoMatch();
  const queryClient = useQueryClient();

  const invalidateUploadedPDFs = () =>
    queryClient.invalidateQueries({
      queryKey: ['reviews', reviewId, 'uploaded-pdfs'],
    });

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

  const handleMatch = async (
    mappings: ReferencePDFMapping[]
  ): Promise<boolean> => {
    try {
      await attachPDFsToReferences.mutateAsync({ reviewId, mappings });
      setOpenMatchDialog(false);
      onSuccess();
      invalidateUploadedPDFs();
      return true;
    } catch (error) {
      return false;
    }
  };

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

  const handleAutoMatch = async (): Promise<boolean> => {
    const referenceIds =
      selectedReferenceIds.length > 0
        ? selectedReferenceIds
        : highlightedReferenceId !== null
          ? [highlightedReferenceId]
          : [];
    try {
      await autoMatch.mutate({ reviewId, referenceIds });
      setOpenMatchDialog(false);
      onSuccess();
      invalidateUploadedPDFs();
      return true;
    } catch (error) {
      return false;
    }
  };

  return {
    openUploadBibDialog,
    setOpenUploadBibDialog,
    openUploadPDFDialog,
    setOpenUploadPDFDialog,
    openMatchDialog,
    setOpenMatchDialog,
    openSavedPDFDialog,
    setopenSavedPDFDialog,
    uploadedPDFs: usefetchUploadedPDFs.data || [],
    handleUploadPDF,
    handleUploadReferences,
    handleMatch,
    combinedReferences,
    detectDuplicateReferences,
    handleAutoMatch,
  };
}
