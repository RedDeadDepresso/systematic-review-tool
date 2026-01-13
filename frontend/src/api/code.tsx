import api from './axios';

export const fetchCodes = async (referenceId: number) => {
  const res = await api.get(`references/${referenceId}/codes/`);
  return res.data;
};

export const fetchReviewCodes = async (reviewId: number) => {
  const res = await api.get(`reviews/${reviewId}/codes/`);
  return res.data;
};

export const createCode = async (
  referenceId: number,
  data: {
    content: string;
  }
) => {
  const res = await api.post(`references/${referenceId}/codes/`, data);
  return res.data;
};

export const editCode = async ({
  id,
  data,
}: {
  id: string;
  data: {
    theme?: number | null;
  };
}) => {
  const res = await api.patch(`/codes/${id}/`, data);
  return res.data;
};
