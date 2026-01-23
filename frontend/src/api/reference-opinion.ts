import api from './axios';

/* ------------------ CREATE OR UPDATE OPINION ------------------ */
export const updateReferenceOpinion = async (payload: {
  reference: number;
  status: 'Undecided' | 'Excluded' | 'Maybe' | 'Included';
}) => {
  const res = await api.patch('/reference-opinions/upsert/', payload);
  return res.data;
};
