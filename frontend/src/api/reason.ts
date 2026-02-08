import type { Reason } from '@/types/reason';
import api from './axios';

/* ------------------ FETCH REASONS ------------------ */
export const fetchReasons = async (params: { reviewId: number }) => {
  const res = await api.get<Reason[]>('/reasons/', {
    params: { review: params.reviewId },
  });
  return res.data;
};

/* ------------------ CREATE REASON ------------------ */
export const createReason = async (payload: {
  review: number;
  name: string;
}) => {
  const res = await api.post<Reason>('/reasons/', payload);
  return res.data;
};

/* ------------------ UPDATE REASON ------------------ */
export const updateReason = async (
  reasonId: number,
  payload: { name: string }
) => {
  const res = await api.patch<Partial<Reason>>(
    `/reasons/${reasonId}/`,
    payload
  );
  return res.data;
};

/* ------------------ DELETE REASON ------------------ */
export const deleteReason = async (reasonId: number) => {
  const res = await api.delete(`/reasons/${reasonId}/`);
  return res.data;
};
