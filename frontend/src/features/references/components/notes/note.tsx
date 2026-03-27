// Editable note attached to a reference.
import {
  MessageSquare,
  Edit3,
  Save,
  X,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Note } from '@/features/references/types/notes';
import {
  useDeleteNote,
  useFetchNotes,
  useUpdateNote,
} from '@/features/references/hooks/use-notes';
import { useState } from 'react';
import { useFetchUser } from '@/features/users/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow, format } from 'date-fns';
import {
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import type { User } from '@/features/users/types/auth';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NoteItemProps {
  currentUser: User;
  referenceId: number;
  note: Note;
  compact?: boolean;
  showBorder?: boolean;
}

export function NoteItem({
  currentUser,
  referenceId,
  note,
  compact = false,
  showBorder = true,
}: NoteItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(note.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const createdDate = new Date(note.createdAt);
  const editedDate = note.editedAt ? new Date(note.editedAt) : null;
  const isEdited = !!editedDate;

  // Check if current user is the author
  const isAuthor = currentUser?.id === note.member.user.id;
  const fullName = note.member.user.firstName + ' ' + note.member.user.lastName;

  // Get initials for avatar fallback
  const initials =
    note.member.user.firstName[0] + ' ' + note.member.user.lastName[0];

  const handleSave = async () => {
    if (editedContent.trim() === note.content.trim()) {
      setIsEditing(false);
      return;
    }

    if (!editedContent.trim()) {
      return; // Don't save empty notes
    }

    try {
      await updateNote.mutateAsync({
        noteId: note.id,
        referenceId: referenceId,
        payload: { content: editedContent.trim() },
      });
      setIsEditing(false);
    } catch (error) {
      // Error is handled by the mutation
      console.error('Failed to update note:', error);
    }
  };

  const handleCancel = () => {
    setEditedContent(note.content);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    try {
      await deleteNote.mutateAsync({
        noteId: note.id,
        referenceId: referenceId,
      });
      setShowDeleteDialog(false);
    } catch (error) {
      // Error is handled by the mutation
      console.error('Failed to delete note:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  if (compact) {
    return (
      <>
        <div
          className={cn(
            'py-3 group',
            showBorder && 'border-b border-border last:border-b-0'
          )}
        >
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={''} alt={fullName} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm font-medium text-foreground">
                      {fullName}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{note.member.user.email}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(createdDate, { addSuffix: true })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Created {format(createdDate, 'MMM d, yyyy h:mm a')}
                  </TooltipContent>
                </Tooltip>
                {isEdited && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="text-xs">
                        Edited
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Edited {format(editedDate, 'MMM d, yyyy h:mm a')}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="text-sm min-h-[80px] resize-none"
                    autoFocus
                    disabled={updateNote.isPending}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={updateNote.isPending || !editedContent.trim()}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={updateNote.isPending}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {note.content}
                </p>
              )}
            </div>

            {/* Actions (only show if user is author) */}
            {isAuthor && !isEditing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Note</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this note? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteNote.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteNote.isPending}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleteNote.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Default (full) layout
  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={''} alt={fullName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {fullName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(createdDate, { addSuffix: true })}
                  </span>
                </div>

                {/* Actions */}
                {isAuthor && !isEditing && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Note content or edit form */}
              {isEditing ? (
                <div className="space-y-3">
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="text-sm min-h-[100px] resize-y"
                    placeholder="Write your note..."
                    autoFocus
                    disabled={updateNote.isPending}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={updateNote.isPending || !editedContent.trim()}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={updateNote.isPending}
                    >
                      Cancel
                    </Button>
                    <span className="text-xs text-muted-foreground ml-2">
                      Press Ctrl+Enter to save, Esc to cancel
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap mb-3">
                    {note.content}
                  </p>

                  {/* Footer metadata */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>
                        Created {format(createdDate, 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>

                    {isEdited && (
                      <div className="flex items-center gap-1">
                        <Edit3 className="h-3 w-3" />
                        <span>
                          Edited {format(editedDate, 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteNote.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteNote.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteNote.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface NotesListProps {
  referenceId: number;
  compact?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function NotesList({
  referenceId,
  compact = false,
  emptyMessage = 'No notes yet',
  className,
}: NotesListProps) {
  const { data: notes = [], isLoading: isNotesLoading } = useFetchNotes({
    referenceId,
  });
  const { data: currentUser, isLoading: isUserLoading } = useFetchUser();
  const loading = isNotesLoading || isUserLoading;

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <div className="text-sm text-muted-foreground">Loading notes...</div>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-8 text-center',
          className
        )}
      >
        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {notes.map((note: Note) => (
        <NoteItem
          key={note.id}
          currentUser={currentUser}
          referenceId={referenceId}
          note={note}
          compact={compact}
          showBorder={compact}
        />
      ))}
    </div>
  );
}
