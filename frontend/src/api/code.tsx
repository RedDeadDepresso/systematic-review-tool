import api from './axios';

export const fetchCodes = async (referenceId: number) => {
  const res = await api.get(`reviews/references/${referenceId}/codes/`);
  return res.data;
};

export const createCode = async (
  referenceId: number,
  data: {
    content: string;
  }
) => {
  const res = await api.post(`reviews/references/${referenceId}/codes/`, data);
  return res.data;
};
