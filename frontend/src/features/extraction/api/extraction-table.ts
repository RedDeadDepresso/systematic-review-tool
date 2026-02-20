import api from '../../../api/client';
import type { ExtractionTableData } from '@/features/extraction/types/extraction';

/* ------------------ FETCH TABLE DATA ------------------ */
export const fetchExtractionTableData = async (reviewId: number) => {
  const res = await api.get<ExtractionTableData>('/extraction/table-data/', {
    params: { review: reviewId },
  });
  return res.data;
};

/* ------------------ BATCH UPDATE ANSWERS ------------------ */
export const batchUpdateAnswers = async (
  answers: Array<{
    reference: number;
    question: number;
    value: string;
  }>
) => {
  const res = await api.post('/extraction-answers/batch-update/', { answers });
  return res.data;
};

/* ------------------ SINGLE ANSWER UPDATE (fallback) ------------------ */
export const saveExtractionAnswer = async (payload: {
  reference: number;
  question: number;
  value: string;
}) => {
  const res = await api.post('/extraction-answers/', payload);
  return res.data;
};

/* ------------------ EXPORT CSV ------------------ */
export const downloadCSVFile = async (reviewId: number) => {
  try {
    const res = await api.get(`/extraction/export-csv/?review_id=${reviewId}`, {
      responseType: 'blob',
    });

    const blob = res.data;
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `extraction_data_review_${reviewId}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Failed to download JSON file:', error);
  }
};

/* ------------------ BULK UPDATE EXTRACTION STATUS ------------------ */
export const bulkUpdateExtractionStatus = async (payload: {
  referenceIds: number[];
  isExtractionCompleted: boolean;
}) => {
  const res = await api.post('/extraction/bulk-update-status/', payload);
  return res.data;
};
