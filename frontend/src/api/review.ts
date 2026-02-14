import type {
  ArticleCounts,
  PrismaData,
  Review,
  ReviewRow,
  ValidationIssue,
} from '@/types/review';
import api from './axios';
import type { Stage } from '@/types/reference';

export const createReview = async (payload: {
  title: string;
  description: string;
}) => {
  const res = await api.post<Review>('/reviews/', payload);
  return res.data;
};

export const fetchReviews = async ({ isActive }: { isActive: boolean }) => {
  const res = await api.get<ReviewRow[]>('/reviews/', {
    params: {
      is_active: isActive,
    },
  });

  return res.data;
};

export const fetchReview = async (id: number) => {
  const res = await api.get<Review>(`/reviews/${id}/`);
  return res.data;
};

export const configureZotero = async (
  reviewId: number,
  payload: {
    libraryId?: string;
    apiKey?: string;
    libraryType?: 'user' | 'group';
  }
) => {
  const res = await api.post(`/reviews/${reviewId}/configure-zotero/`, payload);
  return res.data;
};

export const removeZotero = async (reviewId: number) => {
  const res = await api.delete<{
    message: string;
    is_configured: boolean;
  }>(`/reviews/${reviewId}/remove-zotero/`);
  return res.data;
};

export const fetchZoteroStatus = async (reviewId: number) => {
  const res = await api.get<{
    isConfigured: boolean;
    libraryType: string | null;
    lastSync: string | null;
    totalSyncedReferences: number;
    collectionName: string;
    collectionKey: string;
  }>(`/reviews/${reviewId}/zotero-status/`);
  return res.data;
};

export const pushToZotero = async (
  reviewId: number,
  batchSize: number = 50
) => {
  const res = await api.post<{
    message: string;
    taskId: string;
    status: string;
  }>(`/reviews/${reviewId}/push-to-zotero/`, { batch_size: batchSize });
  return res.data;
};

export const pullFromZotero = async (reviewId: number) => {
  const res = await api.post<{
    message: string;
    taskId: string;
    status: string;
  }>(`/reviews/${reviewId}/pull-from-zotero/`);
  return res.data;
};

export const getTaskStatus = async (taskId: string) => {
  const res = await api.get<{
    taskId: string;
    status: string;
    message: string;
    result?: any;
    error?: string;
  }>(`/reviews/task-status/${taskId}/`);
  return res.data;
};

export const getSyncStatus = async (reviewId: number) => {
  const res = await api.get<{
    totalReferences: number;
    withPdfs: number;
    withoutPdfs: number;
    syncedToZotero: number;
    isZoteroConfigured: boolean;
    recentSyncs: any[];
  }>(`/reviews/${reviewId}/sync-status/`);
  return res.data;
};

export interface ZoteroCollection {
  key: string;
  version: number;
  name: string;
  parentCollection?: string;
  itemCount?: number;
}

export const getZoteroCollections = async (reviewId: number) => {
  const res = await api.get<{ collections: ZoteroCollection[] }>(
    `/reviews/${reviewId}/zotero-collections/`
  );

  return res.data.collections.map((col: any) => ({
    key: col.key,
    version: col.version,
    name: col.data?.name || 'Unnamed Collection',
    parentCollection: col.data?.parentCollection,
  }));
};

export const setZoteroCollection = async (
  reviewId: number,
  collectionKey: string | null,
  collectionName: string | null
) => {
  const res = await api.post<{
    message: string;
    collectionKey: string | null;
    collectionName: string | null;
  }>(`/reviews/${reviewId}/set-zotero-collection/`, {
    collection_key: collectionKey,
    collection_name: collectionName,
  });

  return {
    message: res.data.message,
    collectionKey: res.data.collectionKey,
    collectionName: res.data.collectionName,
  };
};

export const createZoteroCollection = async (
  reviewId: number,
  name: string,
  parentCollection?: string,
  setAsReviewCollection: boolean = false
) => {
  const res = await api.post<{
    message: string;
    collection: {
      key: string;
      name: string;
      version: number;
    };
  }>(`/reviews/${reviewId}/create_zotero_collection/`, {
    name,
    parentCollection,
    setAsReviewCollection,
  });

  return res.data;
};

export const addReferencesToCollection = async (
  reviewId: number,
  collectionKey: string,
  referenceIds?: number[]
) => {
  const res = await api.post<{
    message: string;
    count: number;
  }>(`/reviews/${reviewId}/add_to_collection/`, {
    collectionKey,
    referenceIds,
  });

  return res.data;
};

export interface PrismaApiResponse {
  fileUrl: string; // URL to the diagram image
  interactiveUrl?: string; // URL to interactive Shiny diagram
  data: PrismaData; // structured PRISMA data
  validationIssues?: ValidationIssue[]; // optional validation warnings/errors
}

export const createReviewPrisma = async (id: number) => {
  const res = await api.post<PrismaApiResponse>(`/reviews/${id}/prisma/`);
  return res.data;
};

export const updateReview = async ({
  id,
  payload,
}: {
  id: number;
  payload: {
    title?: string;
    description?: string;
    isActive?: boolean;
    isBlinded?: boolean;
  };
}) => {
  const res = await api.patch<Review>(`/reviews/${id}/`, payload);
  return res.data;
};

export const deleteReview = async ({ id }: { id: number }) => {
  const res = await api.delete(`/reviews/${id}/`);
  return res.data;
};

export const UploadReviewReferences = async (payload: {
  reviewId: number;
  formData: FormData;
}) => {
  const res = await api.post(
    `/reviews/${payload.reviewId}/upload-references/`,
    payload.formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return res.data;
};

export const fetchArticleCounts = async (
  reviewId: number,
  params?: { stage?: Stage }
) => {
  const res = await api.get<ArticleCounts>(
    `/reviews/${reviewId}/article-counts/`,
    {
      params,
    }
  );
  return res.data;
};

export const addData = async (
  reviewId: number,
  payload: {
    dataSource: string;
    dataSink: string;
    articleTypes: string[];
    labelIds: number[];
  }
) => {
  const res = await api.post(`/reviews/${reviewId}/add-data/`, payload);
  return res.data;
};

export interface LatexExportResponse {
  latexCode: string;
  reviewId: number;
  reviewTitle: string;
  themeCount: number;
  format: string;
}

export interface JsonExportResponse {
  reviewId: number;
  reviewTitle: string;
  exportedAt: string;
  themeCount: number;
  themes: Array<{
    id: number;
    name: string;
    description: string;
    subthemeCount: number;
    subthemes: Array<any>;
  }>;
}

// Get LaTeX as JSON (for copying)
export const getLatexExport = async (
  reviewId: number
): Promise<LatexExportResponse> => {
  const res = await api.get(`/reviews/${reviewId}/export-latex/`);
  return res.data;
};

// Download LaTeX as file
export const downloadLatexFile = async (reviewId: number) => {
  try {
    const response = await api.get(
      `/reviews/${reviewId}/export-latex/?download=true`,
      {
        responseType: 'blob',
      }
    );

    const blob = response.data;
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `themes_review_${reviewId}.tex`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Failed to download LaTeX file:', error);
  }
};

// Get JSON export
export const getJsonExport = async (
  reviewId: number
): Promise<JsonExportResponse> => {
  const res = await api.get(`/reviews/${reviewId}/export-json/`);
  return res.data;
};

// Download JSON as file
export const downloadJsonFile = async (reviewId: number) => {
  try {
    const res = await api.get(
      `/reviews/${reviewId}/export-json/?download=true`,
      {
        responseType: 'blob',
      }
    );

    const blob = res.data;
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `themes_review_${reviewId}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Failed to download JSON file:', error);
  }
};
