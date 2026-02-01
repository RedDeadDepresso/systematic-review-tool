import { bulkCreateNote, createNote, fetchNotes } from '@/api/note';
import type { Note } from '@/types/note';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useFetchNotes = ({
  reviewId,
  referenceId,
}: {
  reviewId: number;
  referenceId: number;
}) => {
  return useQuery({
    queryKey: ['references', referenceId, 'notes'],
    queryFn: () => fetchNotes({ reviewId, referenceId }),
  });
};

export const useCreateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reviewId,
      referenceId,
      payload,
    }: {
      reviewId: number;
      referenceId: number;
      payload: { content: string };
    }) => createNote({ review: reviewId, reference: referenceId, ...payload }),
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
  return useMutation({
    mutationFn: bulkCreateNote,
    onSuccess: (data) => {
      toast.success(`${data.created} notes created successfully.`);
    },
    onError: () => toast.error('Failed to create notes.'),
  });
};
