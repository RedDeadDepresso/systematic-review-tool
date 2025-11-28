import {
  createReview,
  deleteReview,
  editReview,
  fetchReview,
  fetchReviews,
  UploadReviewReferences,
} from '@/api/review';
import type { Review } from '@/types/review';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useFetchReviews = (params: { is_active: boolean }) => {
  return useQuery({
    queryKey: ['reviews', params],
    queryFn: () => fetchReviews(params),
  });
};

export const useFetchReview = (id: number | string) => {
  return useQuery({
    queryKey: ['reviews', id],
    queryFn: () => fetchReview(id),
  });
};

export const useCreateReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReview,
    onSuccess: (data) => {
      toast.success('Review has been created.');
      queryClient.setQueryData(
        ['reviews', { is_active: true }],
        (oldData: Review[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
  });
};

export const useEditReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: editReview,
    onSuccess: (data, variables) => {
      // Update the review object
      queryClient.setQueryData(['reviews', variables.id], data);

      // Invalidate references if needed
      if (variables.data?.is_blinded !== undefined) {
        queryClient.invalidateQueries({
          queryKey: ['reviews', variables.id, 'references'],
        });
      }
    },
  });
};

export const useUploadReviewReferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: UploadReviewReferences,
    onSuccess: (
      { uploaded_reference_count }: { uploaded_reference_count: number },
      { reviewId }: { reviewId: number; formData: FormData }
    ) => {
      toast.success(
        `${uploaded_reference_count} References have been uploaded.`
      );
      queryClient.setQueryData(['reviews', reviewId], (oldData: Review) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          reference_count: oldData.reference_count + uploaded_reference_count,
        };
      });
    },
  });
};

export const useDeleteReview = () => {
  return useMutation({
    mutationFn: deleteReview,
    onSuccess: () => {
      toast.success('Review deleted successfully.');
    },
    onError: () => {
      toast.error('Delete failed.');
    },
  });
};
