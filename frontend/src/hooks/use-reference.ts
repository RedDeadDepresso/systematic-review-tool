import {
  updateReference,
  fetchReference,
  fetchReferences,
  uploadReferenceFile,
} from '@/api/reference';
import type { Reference } from '@/types/reference';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { toast } from 'sonner';

export const useFetchReferences = (reviewId: number) => {
  return useQuery({
    queryKey: ['reviews', reviewId, 'references'],
    queryFn: () => fetchReferences(reviewId),
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
