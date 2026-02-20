import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';

export interface SearchMethod {
  id: number;
  name: string;
}

const getSearchMethods = async (reviewId: number) => {
  const res = await api.get<SearchMethod[]>(
    `/reviews/${reviewId}/search_methods/`
  );
  return res.data;
};

export const useSearchMethods = (reviewId: number) => {
  return useQuery({
    queryKey: ['search-methods', reviewId],
    queryFn: () => getSearchMethods(reviewId),
    enabled: !!reviewId,
  });
};
