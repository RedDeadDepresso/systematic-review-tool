import type { SubTheme } from '@/types/sub-theme';
import api from './axios';

export async function fetchSubThemes(reviewId: number): Promise<SubTheme[]> {
  const response = await api.get<SubTheme[]>('/sub-themes/', {
    params: { review: reviewId },
  });

  return response.data;
}

export async function createSubTheme(payload: {
  review: number;
  name: string;
  description?: string;
}): Promise<SubTheme> {
  const response = await api.post<SubTheme>('/sub-themes/', payload);
  return response.data;
}
