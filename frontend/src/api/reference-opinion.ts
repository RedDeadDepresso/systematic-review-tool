import type { OpinionStatus, Stage } from '@/types/reference';
import api from './axios';

/* ------------------ CREATE OR UPDATE OPINION ------------------ */
export const bulkUpsertReferenceOpinions = async (payload: {
  referenceIds: number[];
  status: OpinionStatus;
  stage: Stage;
}) => {
  const res = await api.post('/reference-opinions/bulk-upsert/', payload);
  return res.data;
};
