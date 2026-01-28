import {
  updateReference,
  fetchReference,
  fetchReviewData,
  uploadReferenceFile,
  attachPDFsToReferences,
  type FetchReviewDataParams,
  fetchReferences,
  assignReferences,
  type AssignReferencesPayload,
} from '@/api/reference';
import type { Reference } from '@/types/reference';
import type { UploadedPDF } from '@/types/uploaded-pdf';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { toast } from 'sonner';

export const useFetchReferences = (reviewId: number) => {
  return useQuery({
    queryKey: ['reviews', reviewId, 'references'],
    queryFn: () => fetchReferences(reviewId),
  });
};

export const useFetchReviewData = (params: FetchReviewDataParams) => {
  return useQuery({
    queryKey: [
      'reviews',
      params.review,
      'review-data',
      params.searchMethodIds,
      params.includeKeywords,
      params.excludeKeywords,
      params.labelIds,
      params.duplicateStatuses,
      params.searchQuery,
    ],
    queryFn: () => fetchReviewData(params),
  });
};

export const useFetchReference = (id: number) => {
  return useQuery({
    queryKey: ['references', id],
    queryFn: () => fetchReference(id),
  });
};

export const useUpdateReference = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateReference,
    onSuccess: (updatedReference, { reviewId: reviewId }) => {
      queryClient.setQueryData(
        ['reviews', reviewId, 'references'],
        (oldData: []) => {
          if (!oldData) return oldData;
          return oldData.map((ref: Reference) =>
            ref.id === updatedReference.id ? updatedReference : ref
          );
        }
      );
    },
  });
};

export const useUploadReferenceFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadReferenceFile,
    onSuccess: (updatedReference, { reviewId: reviewId }) => {
      toast.success(`Reference file has been uploaded.`);
      queryClient.setQueryData(
        ['reviews', reviewId, 'references'],
        (oldData: []) => {
          if (!oldData) return oldData;
          return oldData.map((ref: Reference) =>
            ref.id === updatedReference.id ? updatedReference : ref
          );
        }
      );
    },
    onError: (error: AxiosError) => {
      const message =
        error?.response?.data &&
        typeof error.response.data === 'object' &&
        'error' in error.response.data
          ? (error.response.data as { error?: string }).error
          : undefined;
      if (message) toast.error(message);
    },
  });
};

export const useAttachPDFsToReferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: attachPDFsToReferences,

    onSuccess: ({ updatedReferences }, { reviewId }) => {
      toast.success('PDFs have been successfully attached to references.');
      // Update references cache
      queryClient.setQueryData(
        ['reviews', reviewId, 'references'],
        (oldData: Reference[] | undefined) => {
          if (!oldData) return oldData;

          return oldData.map((ref) => {
            const updated = updatedReferences.find(
              (u: { id: number }) => u.id === ref.id
            );
            return updated ? { ...ref, file: updated.file } : ref;
          });
        }
      );

      // Remove deleted uploaded PDFs from cache
      queryClient.setQueryData(
        ['reviews', reviewId, 'uploaded-pdfs'],
        (oldData: UploadedPDF[] | undefined) => {
          if (!oldData) return oldData;

          // Remove PDFs that were attached
          const deletedIds = updatedReferences.map(
            (u: { uploadedPdfId: number }) => u.uploadedPdfId
          );
          return oldData.filter((pdf) => !deletedIds.includes(pdf.id));
        }
      );

      queryClient.invalidateQueries({
        queryKey: ['reviews', reviewId, 'codes'],
      });
    },

    onError: (error: AxiosError) => {
      console.log(error);
      toast.error('Failed to attach PDFs to references.');
    },
  });
};

export const useAssignReferences = () => {
  return useMutation({
    mutationFn: (params: AssignReferencesPayload) => assignReferences(params),
    onSuccess: () => {
      toast.success('References updated successfully.');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to assign references.');
    },
  });
};
