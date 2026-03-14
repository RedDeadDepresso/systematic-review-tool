import { errorMessageString } from '@/lib/error';
import {
  fetchUploadedPDFs,
  uploadPDF,
  deleteUploadedPDF,
} from '@/features/reviews/api/uploaded-pdfs';
import type { UploadedPDF } from '@/features/references/types/uploaded-pdfs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useFetchUploadedPDFs = (reviewId: number) => {
  return useQuery({
    queryKey: ['reviews', reviewId, 'uploaded-pdfs'],
    queryFn: () => fetchUploadedPDFs(reviewId),
    enabled: !!reviewId,
  });
};

export const useUploadPDF = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadPDF,

    onSuccess: (createdPDF, { review }) => {
      toast.success('PDF uploaded successfully.');

      queryClient.setQueryData(
        ['reviews', review, 'uploaded-pdfs'],
        (oldData: UploadedPDF[] | undefined) => {
          if (!oldData) return oldData;
          return [...oldData, createdPDF];
        }
      );
    },

    onError: (error: any) => {
      toast.error(`Failed to upload PDF: ${errorMessageString(error)}.`);
    },
  });
};

export const useDeleteUploadedPDF = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: number; reviewId: number }) =>
      deleteUploadedPDF(id),

    onSuccess: (_, { id, reviewId }) => {
      toast.success('PDF deleted.');

      queryClient.setQueryData(
        ['reviews', reviewId, 'uploaded-pdfs'],
        (oldData: UploadedPDF[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.filter((pdf) => pdf.id !== id);
        }
      );
    },

    onError: (error: any) => {
      toast.error(`Failed to delete PDF: ${errorMessageString(error)}.`);
    },
  });
};
