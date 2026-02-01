import {
  type ScreeningCriteria,
  type ScreeningCriteriaKind,
} from '@/types/screening-criteria';
import api from './axios';

/* ------------------ FETCH SCREENING CRITERIA ------------------ */
export const fetchScreeningCriteria = async (params: { reviewId: number }) => {
  const res = await api.get<ScreeningCriteria[]>('/screening-criteria/', {
    params: {
      review: params.reviewId,
    },
  });
  return res.data;
};

/* ------------------ CREATE SCREENING CRITERIA ------------------ */
export const createScreeningCriteria = async (payload: {
  review: number;
  name: string;
  description: string;
  kind: ScreeningCriteriaKind;
}) => {
  const res = await api.post<ScreeningCriteria>(
    '/screening-criteria/',
    payload
  );
  return res.data;
};

/* ------------------ UPDATE SCREENING CRITERIA ------------------ */
export const updateScreeningCriteria = async (
  criteriaId: number,
  payload: {
    name?: string;
    kind?: ScreeningCriteriaKind;
    description?: string;
  }
) => {
  const res = await api.patch<ScreeningCriteria>(
    `/screening-criteria/${criteriaId}/`,
    payload
  );
  return res.data;
};

/* ------------------ DELETE SCREENING CRITERIA ------------------ */
export const deleteScreeningCriteria = async (criteriaId: number) => {
  const res = await api.delete(`/screening-criteria/${criteriaId}/`);
  return res.data;
};
