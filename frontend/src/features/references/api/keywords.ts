import type {
  Keyword,
  KeywordType,
} from '@/features/references/types/keywords';
import api from '@/api/client';

/* ------------------ FETCH KEYWORDS ------------------ */
export const fetchKeywords = async (params: {
  reviewId: number;
  type?: KeywordType;
}) => {
  const res = await api.get<Keyword[]>('/keywords/', { params });
  return res.data;
};

/* ------------------ CREATE KEYWORD ------------------ */
export const createKeyword = async (payload: {
  review: number;
  name: string;
  type: KeywordType;
}): Promise<Keyword> => {
  const res = await api.post('/keywords/', payload);
  return res.data;
};

/* ------------------ DELETE KEYWORD ------------------ */
export const deleteKeyword = async (keywordId: number) => {
  const res = await api.delete(`/keywords/${keywordId}/`);
  return res.data;
};
