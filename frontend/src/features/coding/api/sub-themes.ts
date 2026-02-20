import type { SubTheme } from '@/features/coding/types/sub-themes';
import api from '../../../api/axios';

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
  mainTheme?: number;
}): Promise<SubTheme> {
  const response = await api.post<SubTheme>('/sub-themes/', payload);
  return response.data;
}

export async function updateSubTheme({
  id,
  payload,
}: {
  id: number;
  payload: Partial<SubTheme>;
}): Promise<SubTheme> {
  const response = await api.patch<SubTheme>(`/sub-themes/${id}/`, payload);
  return response.data;
}

export async function deleteSubTheme(id: number): Promise<void> {
  await api.delete(`/sub-themes/${id}/`);
}
