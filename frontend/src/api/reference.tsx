import api from './axios';

export const fetchReferences = async (reviewId: number | string) => {
  const res = await api.get(`reviews/${reviewId}/references/`);
  return res.data;
};

export const fetchReference = async (
  reviewId: number | string,
  referenceId: number | string
) => {
  const res = await api.get(`/reviews/${reviewId}/references/${referenceId}/`);
  return res.data;
};
