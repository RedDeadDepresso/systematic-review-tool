import api from './axios';

export const fetchThemes = async (reviewId: number) => {
  const res = await api.get(`reviews/${reviewId}/themes/`);
  return res.data;
};

export const createTheme = async (
  reviewId: number,
  data: {
    name: string;
    description: string;
  }
) => {
  const res = await api.post(`reviews/${reviewId}/themes/`, data);
  return res.data;
};
