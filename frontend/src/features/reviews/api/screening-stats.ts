import api from '@/api/client';
import type {
  OpinionStats,
  ScreeningStat,
} from '@/features/reviews/types/screening-stats';

export const fetchScreeningStats = async (reviewId: number) => {
  const res = await api.get<ScreeningStat[]>(
    `/reviews/${reviewId}/screening-stats/`
  );

  return res.data;
};

export const fetchScreeningOpinions = async (reviewId: number) => {
  const res = await api.get<OpinionStats[]>(
    `/reviews/${reviewId}/screening-opinions/`
  );

  return res.data;
};

export const fetchFullTextOpinions = async (reviewId: number) => {
  const res = await api.get<OpinionStats[]>(
    `/reviews/${reviewId}/full-text-opinions/`
  );

  return res.data;
};
