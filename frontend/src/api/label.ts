import type { Label } from '@/types/label';
import api from './axios';

/**
 * Fetch all labels for a review/user
 */
export async function fetchLabels(): Promise<Label[]> {
  const response = await api.get<Label[]>('/labels/');
  return response.data;
}

/**
 * Create a new label
 */
export async function createLabel(payload: { name: string }): Promise<Label> {
  const response = await api.post<Label>('/labels/', payload);
  return response.data;
}

/**
 * Update an existing label
 */
export const updateLabel = async ({
  id,
  payload,
}: {
  id: number;
  payload: Partial<Label>;
}): Promise<Label> => {
  const res = await api.patch<Label>(`/labels/${id}/`, payload);
  return res.data;
};

/**
 * Delete a label
 */
export async function deleteLabel(id: number): Promise<void> {
  await api.delete(`/labels/${id}/`);
}

/**
 * Assign/Remove Labels to References
 */
export interface AssignLabelsPayload {
  referenceIds: number[];
  checkedLabelIds: number[];
  indeterminateLabelIds: number[];
}

export async function assignLabelsToReferences(
  payload: AssignLabelsPayload
): Promise<{ created: number; deleted: number }> {
  const response = await api.post('/labels/assign-to-references/', payload);
  return response.data;
}
