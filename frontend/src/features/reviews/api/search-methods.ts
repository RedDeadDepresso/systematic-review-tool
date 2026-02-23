import api from '@/api/client';
import type { SearchMethod } from '@/features/reviews/types/search-methods';

export const fetchSearchMethods = async (reviewId: number) => {
  const res = await api.get<SearchMethod[]>(
    `/reviews/${reviewId}/search-methods/`
  );
  return res.data;
};

export const deleteSearchMethod = async (searchMethodId: number) => {
  const res = await api.delete(`/search-methods/${searchMethodId}/`);
  return res.data;
};
