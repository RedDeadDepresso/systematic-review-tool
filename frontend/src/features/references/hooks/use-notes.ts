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

export const useFetchNotes = ({ referenceId }: { referenceId: number }) => {
  return useQuery({
    queryKey: ['references', referenceId, 'notes'],
    queryFn: () => fetchNotes({ referenceId }),
  });
};

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
    onSuccess: (data, variables) => {
      toast.success('Note has been created.');
      queryClient.setQueryData(
        ['references', variables.referenceId, 'notes'],
        (oldData: Note[] = []) => {
          if (!oldData) return [data];
          return [...oldData, data];
        }
      );
    },
  });
};

export const useBulkCreateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkCreateNote,
    onSuccess: (data, variables) => {
      toast.success(`${data.created} notes created successfully.`);
      for (const id of variables.referenceIds) {
        queryClient.invalidateQueries({
          queryKey: ['references', id, 'notes'],
        });
      }
    },
    onError: () => toast.error('Failed to create notes.'),
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

    onSuccess: (data, variables) => {
      toast.success('Note updated.');
      queryClient.setQueryData(
        ['references', variables.referenceId, 'notes'],
        (oldData: Note[] | undefined) => {
          if (!oldData) return oldData;

          return oldData.map((note) =>
            note.id === variables.noteId ? data : note
          );
        }
      );
    },

    onError: () => {
      toast.error('Failed to update note.');
    },
  });
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId }: { noteId: number; referenceId: number }) =>
      deleteNote(noteId),

    onSuccess: (_data, variables) => {
      toast.success('Note deleted.');

      queryClient.setQueryData(
        ['references', variables.referenceId, 'notes'],
        (oldData: Note[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.filter((note) => note.id !== variables.noteId);
        }
      );
    },

    onError: () => {
      toast.error('Failed to delete note.');
    },
  });
};
