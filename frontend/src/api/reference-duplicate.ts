import api from './axios';

/* ------------------ DETECT DUPLICATES ------------------ */
export const detectDuplicateReferences = async (reviewId: number) => {
  const res = await api.post('/reference-duplicates/detect/', null, {
    params: { review: reviewId },
  });
  return res.data;
};

/* ------------------ FETCH CURRENT DUPLICATE ------------------ */
export const fetchDuplicateReferences = async (reviewId: number) => {
  const res = await api.get('/reference-duplicates/', {
    params: { review: reviewId },
  });
  return res.data;
};

/* ------------------ RESOLVE DUPLICATE ------------------ */
export const resolveDuplicateReferences = async (
  referenceDuplicateId: number,
  reviewId: number,
  selection: 1 | 2
) => {
  const res = await api.post(
    `/reference-duplicates/${referenceDuplicateId}/resolve/`,
    { selection },
    {
      params: { review: reviewId },
    }
  );
  return res.data;
};
