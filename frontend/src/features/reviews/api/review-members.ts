import type {
  ReviewMember,
  ReviewRole,
} from '@/features/reviews/types/reviews';
import api from '@/api/client';

export const fetchReviewMembers = async (reviewId: number) => {
  const res = await api.get<ReviewMember[]>(`/reviews/${reviewId}/members/`);
  return res.data;
};

export const updateReviewMember = async (
  id: number,
  payload: { role: ReviewRole }
) => {
  const res = await api.patch<ReviewMember>(`/review-members/${id}/`, payload);
  return res.data;
};

export const deleteReviewMember = async (id: number) => {
  const res = await api.delete(`/review-members/${id}/`);
  return res.data;
};
