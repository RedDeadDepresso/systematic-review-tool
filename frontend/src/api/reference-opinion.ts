import type { OpinionStatus } from '@/types/reference';
import api from './axios';

/* ------------------ CREATE OR UPDATE OPINION ------------------ */
export const updateReferenceOpinion = async (payload: {
  referenceIds: number[];
  status: OpinionStatus;
}) => {
  const res = await api.patch('/reference-opinions/upsert/', payload);
  return res.data;
};
