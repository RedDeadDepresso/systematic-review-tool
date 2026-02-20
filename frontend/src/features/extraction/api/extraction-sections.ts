import {
  type ExtractionFormData,
  type ExtractionSection,
} from '@/features/extraction/types/extraction';
import api from '../../../api/axios';

/* ------------------ FETCH EXTRACTION SECTIONS ------------------ */
export const fetchExtractionSections = async (params: { reviewId: number }) => {
  const res = await api.get<ExtractionSection[]>('/extraction-sections/', {
    params: {
      review: params.reviewId,
    },
  });
  return res.data;
};

/* ------------------ CREATE EXTRACTION SECTION ------------------ */
export const createExtractionSection = async (payload: {
  review: number;
  name: string;
}) => {
  const res = await api.post<ExtractionSection>(
    '/extraction-sections/',
    payload
  );
  return res.data;
};

/* ------------------ UPDATE EXTRACTION SECTION ------------------ */
export const updateExtractionSection = async (
  sectionId: number,
  payload: {
    name?: string;
    order?: number;
  }
) => {
  const res = await api.patch<ExtractionSection>(
    `/extraction-sections/${sectionId}/`,
    payload
  );
  return res.data;
};

/* ------------------ DELETE EXTRACTION SECTION ------------------ */
export const deleteExtractionSection = async (sectionId: number) => {
  const res = await api.delete(`/extraction-sections/${sectionId}/`);
  return res.data;
};

export const fetchExtractionFormData = async (
  referenceId: number,
  reviewId: number
): Promise<ExtractionFormData> => {
  const res = await api.get('/extraction-form/form-data/', {
    params: { referenceId, reviewId },
  });
  return res.data;
};
