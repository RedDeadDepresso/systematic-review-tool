import api from './axios';

export const createReview = async (data: {
  title: string;
  description: string;
}) => {
  const res = await api.post('/reviews/', data);
  return res.data;
};

export const fetchReviews = async (params: { is_active: boolean }) => {
  const res = await api.get('/reviews/', { params });
  return res.data;
};

export const fetchReview = async (id: number | string) => {
  const res = await api.get(`/reviews/${id}`);
  return res.data;
};

export const editReview = async ({
  id,
  data,
}: {
  id: number;
  data: {
    title?: string;
    description?: string;
    is_active?: boolean;
  };
}) => {
  const res = await api.patch(`/reviews/${id}/`, data);
  return res.data;
};

export const UploadReviewReferences = async (data: {
  reviewId: number | string;
  formData: FormData;
}) => {
  const res = await api.post(
    `/reviews/${data.reviewId}/references/upload/`,
    data.formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return res.data;
};

export const deleteReview = async ({ id }: { id: number }) => {
  const res = await api.delete(`/reviews/${id}/`);
  return res.data;
};
