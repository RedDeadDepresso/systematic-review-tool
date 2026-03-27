import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  assignLabelsToReferences,
  createLabel,
  deleteLabel,
  fetchLabels,
  updateLabel,
  type AssignLabelsPayload,
} from '@/features/references/api/labels';
import type { Label } from '@/features/references/types/labels';
import {
  applyCreate,
  applyDelete,
  applyUpdate,
  onMutationError,
} from '@/lib/query-helpers';

export const labelKeys = {
  all: ['labels'] as const,
};

export function useFetchLabels() {
  return useQuery({ queryKey: labelKeys.all, queryFn: fetchLabels });
}

export function useCreateLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLabel,
    onSuccess: (data) =>
      applyCreate(queryClient, labelKeys.all, data, 'Label has been created.'),
    onError: onMutationError('create label'),
  });
}

export function useUpdateLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateLabel,
    onSuccess: (data) =>
      applyUpdate(queryClient, labelKeys.all, data, 'Label has been updated.'),
    onError: onMutationError('update label'),
  });
}

export function useDeleteLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteLabel(id),
    onSuccess: (_data, id) =>
      applyDelete<Label>(
        queryClient,
        labelKeys.all,
        id,
        'Label has been deleted.'
      ),
    onError: onMutationError('delete label'),
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
    onError: onMutationError('apply labels'),
  });
}
