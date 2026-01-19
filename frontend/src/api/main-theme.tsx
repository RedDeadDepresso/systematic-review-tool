import api from './axios';
import type { MainTheme } from '@/types/main-theme';

export async function fetchMainThemes(reviewId: number): Promise<MainTheme[]> {
  const response = await api.get<MainTheme[]>('/main-themes/', {
    params: { review: reviewId },
  });

  return response.data;
}

export async function createMainTheme(payload: {
  review: number;
  name: string;
  description?: string;
}): Promise<MainTheme> {
  const response = await api.post<MainTheme>('/main-themes/', payload);
  return response.data;
}

export function updateMainTheme(
  id: number,
  payload: Partial<MainTheme>
): Promise<MainTheme> {
  return api.patch(`/main-themes/${id}/`, payload);
}

export function deleteMainTheme(id: number): Promise<void> {
  return api.delete(`/main-themes/${id}/`);
}
