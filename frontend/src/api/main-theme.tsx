import type { SubTheme } from '@/types/sub-theme';
import api from './axios';

export async function fetchMainThemes(reviewId: number): Promise<SubTheme[]> {
  const response = await api.get<SubTheme[]>('/main-themes/', {
    params: { review: reviewId },
  });

  return response.data;
}

export async function createMainTheme(payload: {
  review: number;
  name: string;
  description?: string;
}): Promise<SubTheme> {
  const response = await api.post<SubTheme>('/main-themes/', payload);
  return response.data;
}
