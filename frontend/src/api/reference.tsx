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

export const detectDuplicateReferences = async (reviewId: number | string) => {
  const res = await api.post(`/reviews/${reviewId}/reference-duplicate-pairs/`);
  return res.data;
};

export const fetchDuplicateReference = async (reviewId: number | string) => {
  const res = await api.get(
    `/reviews/${reviewId}/reference-duplicate-pairs/retrieve/`
  );
  return res.data;
};

export const resolveDuplicateReferences = async (
  reviewId: number | string,
  referenceDuplicateId: number | string,
  selection: 1 | 2
) => {
  const res = await api.post(
    `/reviews/${reviewId}/reference-duplicate-pairs/${referenceDuplicateId}/resolve/`,
    { selection: selection }
  );
  return res.data;
};

export const editReference = async ({
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
    `/reviews/${reviewId}/references/${referenceId}/`,
    data
  );
  return res.data;
};
