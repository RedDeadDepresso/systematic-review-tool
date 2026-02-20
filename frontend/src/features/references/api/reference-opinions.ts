import type {
  OpinionStatus,
  Stage,
} from '@/features/references/types/references';
import api from '@/api/client';

/* ------------------ CREATE OR UPDATE OPINION ------------------ */
export const bulkUpsertReferenceOpinions = async (payload: {
  referenceIds: number[];
  status: OpinionStatus;
  stage: Stage;
  reason?: number | null;
}) => {
  const res = await api.post('/reference-opinions/bulk-upsert/', payload);
  return res.data;
};
