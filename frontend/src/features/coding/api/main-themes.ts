import api from '../../../api/axios';
import type { MainTheme } from '@/features/coding/types/main-themes';

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

export async function updateMainTheme({
  id,
  payload,
}: {
  id: number;
  payload: Partial<MainTheme>;
}): Promise<MainTheme> {
  const response = await api.patch<MainTheme>(`/main-themes/${id}/`, payload);
  return response.data;
}

export function deleteMainTheme(id: number): Promise<void> {
  return api.delete(`/main-themes/${id}/`);
}
