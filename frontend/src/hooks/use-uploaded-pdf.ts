import {
  fetchUploadedPDFs,
  uploadPDF,
  deleteUploadedPDF,
} from '@/api/uploaded-pdf';
import type { UploadedPDF } from '@/types/uploaded-pdf';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
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

    onError: () => {
      toast.error('Failed to delete PDF.');
    },
  });
};
