import type { Code } from '@/features/coding/types/codes';
import api from '@/api/client';
import type { Content, ScaledPosition } from 'react-pdf-highlighter-plus';

export async function fetchCodes(reviewId: number): Promise<Code[]> {
  const response = await api.get<Code[]>('/codes/', {
    params: { review: reviewId },
  });
  return response.data;
}

export async function createCode(payload: {
  name: string;
  review: number;
  reference?: number;
  content?: Content;
  comment?: string;
  position?: ScaledPosition;
  type?: string;
  highlightColor?: string;
  highlightStyle?: string;
}): Promise<Code> {
  const response = await api.post<Code>('/codes/', payload);
  return response.data;
}

export const updateCode = async ({
  id,
  payload,
}: {
  id: string;
  payload: Partial<Code>;
}): Promise<Code> => {
  const res = await api.patch(`/codes/${id}/`, payload);
  return res.data;
};

// Delete a code
export async function deleteCode(id: string): Promise<void> {
  await api.delete(`/codes/${id}/`);
}
