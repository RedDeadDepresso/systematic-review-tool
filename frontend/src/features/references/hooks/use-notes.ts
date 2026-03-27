import {
  bulkCreateNote,
  createNote,
  deleteNote,
  fetchNotes,
  updateNote,
} from '@/features/references/api/notes';
import type { Note } from '@/features/references/types/notes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  applyCreate,
  applyDelete,
  applyUpdate,
  onMutationError,
} from '@/lib/query-helpers';

export const noteKeys = {
  list: (referenceId: number) => ['references', referenceId, 'notes'] as const,
};

export const useFetchNotes = ({ referenceId }: { referenceId: number }) =>
  useQuery({
    queryKey: noteKeys.list(referenceId),
    queryFn: () => fetchNotes({ referenceId }),
  });

export const useCreateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      referenceId,
      payload,
    }: {
      reviewId: number;
      referenceId: number;
      payload: { content: string };
    }) => createNote({ reference: referenceId, ...payload }),
    onSuccess: (data, variables) =>
      applyCreate(
        queryClient,
        noteKeys.list(variables.referenceId),
        data,
        'Note has been created.'
      ),
    onError: onMutationError('create note'),
  });
};

export const useBulkCreateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkCreateNote,
    onSuccess: (data, variables) => {
      toast.success(`${data.created} notes created successfully.`);
      for (const id of variables.referenceIds) {
        queryClient.invalidateQueries({ queryKey: noteKeys.list(id) });
      }
    },
    onError: onMutationError('create notes'),
  });
};

export const useUpdateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      noteId,
      payload,
    }: {
      noteId: number;
      referenceId: number;
      payload: { content: string };
    }) => updateNote(noteId, payload),
    onSuccess: (data, variables) =>
      applyUpdate(
        queryClient,
        noteKeys.list(variables.referenceId),
        data,
        'Note updated.'
      ),
    onError: onMutationError('update note'),
  });
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId }: { noteId: number; referenceId: number }) =>
      deleteNote(noteId),
    onSuccess: (_data, variables) =>
      applyDelete<Note>(
        queryClient,
        noteKeys.list(variables.referenceId),
        variables.noteId,
        'Note deleted.'
      ),
    onError: onMutationError('delete note'),
  });
};
