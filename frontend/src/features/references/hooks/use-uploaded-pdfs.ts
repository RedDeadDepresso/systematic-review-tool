import {
  fetchUploadedPDFs,
  uploadPDF,
  deleteUploadedPDF,
} from '@/features/reviews/api/uploaded-pdfs';
import type { UploadedPDF } from '@/features/references/types/uploaded-pdfs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { applyDelete, onMutationError } from '@/lib/query-helpers';

export const uploadedPdfKeys = {
  list: (reviewId: number) => ['reviews', reviewId, 'uploaded-pdfs'] as const,
};

export const useFetchUploadedPDFs = (reviewId: number) =>
  useQuery({
    queryKey: uploadedPdfKeys.list(reviewId),
    queryFn: () => fetchUploadedPDFs(reviewId),
    enabled: !!reviewId,
  });

export const useUploadPDF = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadPDF,
    onSuccess: (createdPDF, { review }) => {
      toast.success('PDF uploaded successfully.');
      // Append rather than replace — use setQueryData directly since applyCreate
      // checks oldData truthiness but uploaded PDFs can legitimately start empty.
      queryClient.setQueryData<UploadedPDF[]>(
        uploadedPdfKeys.list(review),
        (old = []) => [...old, createdPDF]
      );
    },
    onError: onMutationError('upload PDF'),
  });
};

export const useDeleteUploadedPDF = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; reviewId: number }) =>
      deleteUploadedPDF(id),
    onSuccess: (_, { id, reviewId }) =>
      applyDelete<UploadedPDF>(
        queryClient,
        uploadedPdfKeys.list(reviewId),
        id,
        'PDF deleted.'
      ),
    onError: onMutationError('delete PDF'),
  });
};
