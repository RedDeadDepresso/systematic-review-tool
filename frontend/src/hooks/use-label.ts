import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  assignLabelsToReferences,
  createLabel,
  deleteLabel,
  fetchLabels,
  updateLabel,
  type AssignLabelsPayload,
} from '@/api/label';
import type { Label } from '@/types/label';

/**
 * Fetch all labels for the current user
 */
export function useFetchLabels() {
  return useQuery({
    queryKey: ['labels'],
    queryFn: fetchLabels,
  });
}

/**
 * Create a new label
 */
export function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLabel,
    onSuccess: (data) => {
      toast.success('Label has been created.');
      queryClient.setQueryData<Label[]>(['labels'], (oldData = []) => [
        ...oldData,
        data,
      ]);
    },
  });
}

/**
 * Update an existing label
 */
export function useUpdateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateLabel,
    onSuccess: (data) => {
      toast.success('Label has been updated.');
      queryClient.setQueryData<Label[]>(['labels'], (oldData = []) =>
        oldData.map((label) => (label.id === data.id ? data : label))
      );
    },
  });
}

/**
 * Delete a label
 */
export function useDeleteLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: number }) => deleteLabel(id),
    onSuccess: (_data, variables) => {
      toast.success('Label has been deleted.');
      queryClient.setQueryData<Label[]>(['labels'], (oldData = []) =>
        oldData.filter((label) => label.id !== variables.id)
      );
    },
  });
}

export function useAssignLabelsToReferences() {
  return useMutation({
    mutationFn: (payload: AssignLabelsPayload) =>
      assignLabelsToReferences(payload),
    onSuccess: (data) => {
      toast.success(
        `Labels applied: ${data.created} created, ${data.deleted} removed`
      );
    },
    onError: () => {
      toast.error('Failed to apply labels');
    },
  });
}
