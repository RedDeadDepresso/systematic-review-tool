import { createNote, fetchNotes } from '@/api/note';
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
    queryFn: () => fetchNotes(reviewId, referenceId),
  });
};

export const useCreateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reviewId,
      referenceId,
      data,
    }: {
      reviewId: number | string;
      referenceId: number;
      data: { content: string };
    }) => createNote(Number(reviewId), referenceId, data),
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
