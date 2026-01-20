import api from './axios';

export const createReview = async (data: {
  title: string;
  description: string;
}) => {
  const res = await api.post('/reviews/', data);
  return res.data;
};

export const fetchReviews = async ({ isActive }: { isActive: boolean }) => {
  const res = await api.get('/reviews/', {
    params: {
      is_active: isActive,
    },
  });

  return res.data;
};

export const fetchReview = async (id: number | string) => {
  const res = await api.get(`/reviews/${id}/`);
  return res.data;
};

export const editReview = async ({
  id,
  data,
}: {
  id: number;
  data: {
    title?: string;
    description?: string;
    isActive?: boolean;
    isBlinded?: boolean;
  };
}) => {
  const res = await api.patch(`/reviews/${id}/`, data);
  return res.data;
};

export const deleteReview = async ({ id }: { id: number }) => {
  const res = await api.delete(`/reviews/${id}/`);
  return res.data;
};

export const UploadReviewReferences = async (data: {
  reviewId: number | string;
  formData: FormData;
}) => {
  const res = await api.post(
    `/reviews/${data.reviewId}/upload-references/`,
    data.formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
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
