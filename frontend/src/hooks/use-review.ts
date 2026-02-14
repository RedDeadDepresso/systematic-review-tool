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
  configureZotero,
  fetchZoteroStatus,
  removeZotero,
  pullFromZotero,
  pushToZotero,
  getSyncStatus,
  getTaskStatus,
  setZoteroCollection,
  getZoteroCollections,
  addReferencesToCollection,
  createZoteroCollection,
} from '@/api/review';
import type { Review } from '@/types/review';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { type Stage } from '@/types/reference';

export const useFetchReviews = (params: { isActive: boolean }) => {
  return useQuery({
    queryKey: ['reviews', params],
    queryFn: () => fetchReviews(params),
  });
};

export const useFetchReview = (id: number) => {
  return useQuery({
    queryKey: ['reviews', id],
    queryFn: () => fetchReview(id),
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
    },
  });
};

export const useUploadReviewReferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: UploadReviewReferences,
    onSuccess: (
      { uploadedReferenceCount }: { uploadedReferenceCount: number },
      { reviewId }: { reviewId: number; formData: FormData }
    ) => {
      toast.success(`${uploadedReferenceCount} References have been uploaded.`);
      queryClient.setQueryData(['reviews', reviewId], (oldData: Review) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          referenceCount: oldData.referenceCount + uploadedReferenceCount,
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

export const useConfigureZotero = (reviewId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      libraryId?: string;
      apiKey?: string;
      libraryType?: 'user' | 'group';
    }) => configureZotero(reviewId, payload),
    onSuccess: () => {
      toast.success('Review Zotero configuration updated');
      queryClient.invalidateQueries({
        queryKey: ['reviews', reviewId],
      });
      queryClient.invalidateQueries({
        queryKey: ['reviews', reviewId, 'zotero-status'],
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to configure Zotero');
    },
  });
};

export const useRemoveZotero = (reviewId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => removeZotero(reviewId),
    onSuccess: () => {
      toast.success('Zotero configuration removed');
      queryClient.invalidateQueries({
        queryKey: ['reviews', reviewId, 'zotero-status'],
      });
    },
    onError: () => {
      toast.error('Failed to remove Zotero configuration');
    },
  });
};

export const useFetchZoteroStatus = (reviewId: number) => {
  return useQuery({
    queryKey: ['reviews', reviewId, 'zotero-status'],
    queryFn: () => fetchZoteroStatus(reviewId),
    enabled: !!reviewId,
  });
};

export const usePushToZotero = (reviewId: number) => {
  return useMutation({
    mutationFn: (batchSize?: number) => pushToZotero(reviewId, batchSize),
    onSuccess: () => {
      toast.success('Push to Zotero started');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to push to Zotero');
    },
  });
};

export const usePullFromZotero = (reviewId: number) => {
  return useMutation({
    mutationFn: () => pullFromZotero(reviewId),
    onSuccess: () => {
      toast.success('Pull from Zotero started');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to pull from Zotero');
    },
  });
};

export const useTaskStatus = (taskId: string | null) => {
  return useQuery({
    queryKey: ['task-status', taskId],
    queryFn: () => getTaskStatus(taskId!),
    enabled: !!taskId,
    refetchInterval: (data) => {
      // Stop polling when task is complete
      if (data?.status === 'SUCCESS' || data?.status === 'FAILURE') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });
};

export const useSyncStatus = (reviewId: number) => {
  return useQuery({
    queryKey: ['reviews', reviewId, 'sync-status'],
    queryFn: () => getSyncStatus(reviewId),
    enabled: !!reviewId,
  });
};

export const useZoteroCollections = (reviewId: number) => {
  return useQuery({
    queryKey: ['reviews', reviewId, 'zotero-collections'],
    queryFn: () => getZoteroCollections(reviewId),
    enabled: !!reviewId,
  });
};

export const useSetZoteroCollection = (reviewId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      collectionKey: string | null;
      collectionName: string | null;
    }) =>
      setZoteroCollection(
        reviewId,
        params.collectionKey,
        params.collectionName
      ),
    onSuccess: () => {
      toast.success('Collection filter updated');
      queryClient.invalidateQueries({
        queryKey: ['reviews', reviewId, 'zotero-status'],
      });
      queryClient.invalidateQueries({
        queryKey: ['reviews', reviewId],
      });
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.error || 'Failed to update collection filter'
      );
    },
  });
};

// src/hooks/use-zotero.ts

export const useCreateZoteroCollection = (reviewId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      name: string;
      parentCollection?: string;
      setAsReviewCollection?: boolean;
    }) =>
      createZoteroCollection(
        reviewId,
        params.name,
        params.parentCollection,
        params.setAsReviewCollection
      ),
    onSuccess: () => {
      toast.success('Collection created successfully');
      queryClient.invalidateQueries({
        queryKey: ['reviews', reviewId, 'zotero-collections'],
      });
      queryClient.invalidateQueries({
        queryKey: ['reviews', reviewId, 'zotero-status'],
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create collection');
    },
  });
};

export const useAddToCollection = (reviewId: number) => {
  return useMutation({
    mutationFn: (params: { collectionKey: string; referenceIds?: number[] }) =>
      addReferencesToCollection(
        reviewId,
        params.collectionKey,
        params.referenceIds
      ),
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.error || 'Failed to add references to collection'
      );
    },
  });
};
