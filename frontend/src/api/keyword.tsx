import api from './axios';

export const fetchKeywords = async (params: {
  reviewId: string | number;
  isInclusive: boolean;
}) => {
  const res = await api.get(`reviews/${params.reviewId}/keywords/`, { params });
  return res.data;
};

export const createKeyword = async (data: {
  review_id: string | number;
  name: string;
  isInclusive: boolean;
}) => {
  const res = await api.post(`reviews/${data.review_id}/keywords/`, data);
  return res.data;
};
