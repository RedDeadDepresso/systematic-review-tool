import type {
  ArticleCounts,
  PrismaData,
  Review,
  ReviewRow,
  ValidationIssue,
} from '@/features/reviews/types/reviews';
import api from '../../../api/client';
import type { Stage } from '@/features/references/types/references';

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
