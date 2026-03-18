import { errorMessageString } from '@/lib/error';
import {
  createReview,
  deleteReview,
  updateReview,
  fetchReview,
  fetchReviews,
  UploadReviewReferences,
  fetchArticleCounts,
  addData,
  createReviewPrisma,
  detectDuplicateReferences,
} from '@/features/reviews/api/reviews';
import type { Review } from '@/features/reviews/types/reviews';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { type Stage } from '@/features/references/types/references';
import {
  autoResolveDuplicates,
  type AutoResolveRequest,
} from '@/features/reviews/api/reviews';

interface UseFetchReviewsParams {
  isActive: boolean;
  enabled?: boolean;
}

export const useFetchReviews = ({
  isActive,
  enabled = true,
}: UseFetchReviewsParams) => {
  return useQuery({
    queryKey: ['reviews', { isActive }],
    queryFn: () => fetchReviews({ isActive }),
    enabled,
  });
};
export const useFetchReview = (id: number | null) => {
  return useQuery({
    queryKey: ['reviews', id],
    queryFn: () => fetchReview(id!),
    enabled: !!id,
  });
};

export const useCreateReviewPrisma = (id: number) => {
  return useQuery({
    queryKey: ['reviews', id, 'prisma'],
    queryFn: () => createReviewPrisma(id),
  });
};

export const useFetchArticleCounts = (
  reviewId: number,
  params?: { stage?: Stage }
) => {
  return useQuery({
    queryKey: ['articleCounts', reviewId, params],
    queryFn: () => fetchArticleCounts(reviewId, params),
  });
};

export const useAddData = (reviewId: number) => {
  return useMutation({
    mutationFn: (payload: {
      dataSource: string;
      dataSink: string;
      articleTypes: string[];
      labelIds: number[];
    }) => addData(reviewId, payload),
    onError: (error: any) => {
      toast.error(`Failed to add data: ${errorMessageString(error)}`);
    },
  });
};

export const useCreateReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReview,
    onSuccess: (data) => {
      toast.success('Review has been created.');
      queryClient.setQueryData(
        ['reviews', { isActive: true }],
        (oldData: Review[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
    onError: (error: any) => {
      toast.error(`Failed to create review: ${errorMessageString(error)}`);
    },
  });
};

export const useUpdateReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateReview,
    onSuccess: (data, variables) => {
      // Update the review object
      queryClient.setQueryData(['reviews', variables.id], data);

      // Invalidate references if needed
      if (variables.payload?.isBlinded !== undefined) {
        queryClient.invalidateQueries({
          queryKey: ['reviews', variables.id, 'references'],
        });
      }
      toast.success('Review has been updated.');
    },
    onError: (error: any) => {
      toast.error(`Failed to update review: ${errorMessageString(error)}`);
    },
  });
};

export const useUploadReviewReferences = () => {
  return useMutation({
    mutationFn: UploadReviewReferences,
    onSuccess: () => {
      toast.success('References have been uploaded.');
    },
    onError: (error: any) => {
      toast.error(`Failed to upload references: ${errorMessageString(error)}`);
    },
  });
};

export const useDeleteReview = () => {
  return useMutation({
    mutationFn: deleteReview,
    onSuccess: () => {
      toast.success('Review deleted successfully.');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete review: ${errorMessageString(error)}`);
    },
  });
};

export const useDetectDuplicateReferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId }: { reviewId: number }) =>
      detectDuplicateReferences(reviewId),
    onSuccess: (_, { reviewId }) => {
      toast.success(`Duplicate detection started.`);
      queryClient.setQueryData(['reviews', reviewId], (oldData: Review) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          duplicateClustersCount: null,
          duplicateDetectionStatus: 'Pending',
        };
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to detect duplicates: ${errorMessageString(error)}`);
    },
  });
};

export const useAutoResolveDuplicates = (reviewId: number) => {
  return useMutation({
    mutationFn: (settings: AutoResolveRequest) =>
      autoResolveDuplicates(reviewId, settings),
    onSuccess: (data) => {
      toast.success(
        `Auto-resolution started with ${Math.round(data.confidenceThreshold * 100)}% confidence threshold`
      );
    },
    onError: (error: any) => {
      toast.error(
        `Failed to start auto-resolution: ${errorMessageString(error)}`
      );
    },
  });
};
