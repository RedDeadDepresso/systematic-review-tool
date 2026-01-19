import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '../ui/card';
import { fetchNotes } from '@/api/note';
import { Skeleton } from '../ui/skeleton';
import type { Note } from '@/types/note';

export function NoteList({
  reviewId,
  referenceId,
}: {
  reviewId: number;
  referenceId: number;
}) {
  // Fetch notes
  const { data: notes, isLoading } = useQuery<Note[]>({
    queryKey: ['references', referenceId, 'notes'],
    queryFn: () => fetchNotes(reviewId, referenceId),
  });

  // Render loading state
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          {notes && notes.length > 0 ? (
            notes.map((note) => (
              <div
                key={note.id}
                className="flex flex-col border-b border-border last:border-none pb-2"
              >
                <p className="text-sm text-foreground">{note.content}</p>
                <div className="text-xs text-muted-foreground mt-1">
                  {note.author?.name && (
                    <span className="mr-2 font-medium text-foreground/80">
                      {note.author.name}
                    </span>
                  )}
                  <span>{new Date(note.dateCreated).toLocaleString()}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
