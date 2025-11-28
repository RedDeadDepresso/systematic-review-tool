import api from './axios';

export const updateReferenceOpinion = async ({
  reviewId,
  referenceId,
  data,
}: {
  reviewId: number;
  referenceId: number;
  data: {
    status: 'Undecided' | 'Excluded' | 'Maybe' | 'Included';
  };
}) => {
  const res = await api.patch(
    `/reviews/${reviewId}/references/${referenceId}/opinions/`,
    data
  );
  return res.data;
};
