import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { X, Pencil, Send, SquareSlash, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  useCreateScreeningCriteria,
  useDeleteScreeningCriteria,
  useFetchScreeningCriteria,
  useUpdateScreeningCriteria,
} from '@/features/reviews/hooks/use-screening-criteria';
import type { ScreeningCriteria } from '@/features/reviews/types/screening-criteria';
import type { ReviewRole } from '@/features/reviews/types/reviews';
import { can } from '@/lib/permissions';

export interface ScreeningCriteriaProps {
  reviewId: number;
  userRole: ReviewRole;
}

interface ScreeningCriteriaContentProps extends ScreeningCriteriaProps {
  onClose?: () => void;
  showCloseButton?: boolean;
  showKeyboardHint?: boolean;
  showHeader?: boolean;
}

export function ScreeningCriteriaContent({
  reviewId,
  userRole,
  onClose,
  showCloseButton = false,
  showKeyboardHint = false,
  showHeader = true,
}: ScreeningCriteriaContentProps) {
  const [activeTab, setActiveTab] = useState<'inclusion' | 'exclusion'>(
    'inclusion'
  );
  const [newCriteriaName, setNewCriteriaName] = useState('');
  const [newCriteriaDescription, setNewCriteriaDescription] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [criteriaToDelete, setCriteriaToDelete] = useState<number | null>(null);

  const editNameInputRef = useRef<HTMLInputElement>(null);
  const fetchCriteria = useFetchScreeningCriteria({ reviewId });
  const createCriteria = useCreateScreeningCriteria();
  const updateCriteria = useUpdateScreeningCriteria();
  const deleteCriteria = useDeleteScreeningCriteria();

  useEffect(() => {
    if (editingId && editNameInputRef.current) {
      editNameInputRef.current.focus();
    }
  }, [editingId]);

  const inclusionCriteria =
    fetchCriteria.data?.filter(
      (c: ScreeningCriteria) => c.kind === 'Inclusive'
    ) ?? [];
  const exclusionCriteria =
    fetchCriteria.data?.filter(
      (c: ScreeningCriteria) => c.kind === 'Exclusive'
    ) ?? [];
  const currentCriteria =
    activeTab === 'inclusion' ? inclusionCriteria : exclusionCriteria;

  const handleAddCriteria = async () => {
    if (!newCriteriaName.trim()) return;

    // compute criteria kind before try block to avoid value blocks in try/catch
    const criteriaKind = activeTab === 'inclusion' ? 'Inclusive' : 'Exclusive';

    try {
      await createCriteria.mutateAsync({
        review: reviewId,
        name: newCriteriaName.trim(),
        description: newCriteriaDescription.trim(),
        kind: criteriaKind,
      });
      setNewCriteriaName('');
      setNewCriteriaDescription('');
    } catch (error) {
      console.log(error);
    }
  };

  const handleEditStart = (c: ScreeningCriteria) => {
    setEditingId(c.id);
    setEditingName(c.name);
    setEditingDescription(c.description);
  };

  const handleEditSave = async (id: number) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await updateCriteria.mutateAsync({
        criteriaId: id,
        reviewId,
        payload: {
          name: editingName.trim(),
          description: editingDescription.trim(),
        },
      });
      setEditingId(null);
      setEditingName('');
      setEditingDescription('');
    } catch (error) {
      console.log(error);
    }
  };

  const handleDeleteClick = (id: number) => {
    setCriteriaToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!criteriaToDelete) return;
    try {
      await deleteCriteria.mutateAsync({
        criteriaId: criteriaToDelete,
        reviewId,
      });
      setDeleteDialogOpen(false);
      setCriteriaToDelete(null);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-border shrink-0">
        {showHeader && (
          <div className="flex items-center gap-2">
            <SquareSlash className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <span className="text-sm sm:text-base font-semibold">
              Screening Criteria
            </span>
          </div>
        )}
        {showCloseButton && onClose && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Keyboard hint */}
      {showKeyboardHint && (
        <div className="hidden sm:block px-4 py-2 text-xs sm:text-sm text-primary shrink-0">
          Or press "c" on the keyboard to view criteria
        </div>
      )}

      {/* Tabs */}
      <div className="px-3 sm:px-4 pt-3 shrink-0">
        <div className="flex border border-border rounded-lg overflow-hidden">
          {(['inclusion', 'exclusion'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors capitalize',
                tab === 'exclusion' && 'border-l border-border',
                activeTab === tab
                  ? 'bg-background text-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Criteria list */}
      <div className="px-3 sm:px-4 py-3 min-h-[150px] overflow-y-auto flex-1">
        {currentCriteria.length === 0 ? (
          <p className="text-xs sm:text-sm text-muted-foreground text-center py-8">
            No {activeTab} criteria yet
          </p>
        ) : (
          <div className="space-y-0">
            {currentCriteria.map((c: ScreeningCriteria, index: number) => (
              <React.Fragment key={c.id}>
                <div className="py-2 sm:py-3">
                  <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2">
                    <span
                      className={cn(
                        'inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded whitespace-nowrap',
                        activeTab === 'inclusion'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {activeTab === 'inclusion' ? 'Inclusion' : 'Exclusion'}{' '}
                      {index + 1}
                    </span>
                    {can('modifyScreeningCriteria', userRole) && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleEditStart(c)}
                        >
                          <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleDeleteClick(c.id)}
                        >
                          <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {editingId === c.id ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1 block">
                          Name
                        </label>
                        <Input
                          ref={editNameInputRef}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSave(c.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="h-7 sm:h-8 text-xs sm:text-sm font-medium"
                          placeholder="Criteria name..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1 block">
                          Description
                        </label>
                        <Textarea
                          value={editingDescription}
                          onChange={(e) =>
                            setEditingDescription(e.target.value)
                          }
                          className="text-xs sm:text-sm min-h-[50px] sm:min-h-[60px] resize-none"
                          placeholder="Criteria description..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 sm:h-8 px-2 sm:px-3 text-xs"
                          onClick={() => handleEditSave(c.id)}
                          disabled={!editingName.trim()}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 sm:h-8 px-2 sm:px-3 text-xs"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 sm:space-y-1.5">
                      <p className="text-xs sm:text-sm font-semibold text-foreground break-words">
                        {c.name}
                      </p>
                      {c.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words">
                          {c.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {index < currentCriteria.length - 1 && <Separator />}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Add criteria */}
      {can('modifyScreeningCriteria', userRole) && (
        <div className="px-3 sm:px-4 py-3 border-t border-border shrink-0">
          <div className="space-y-2">
            <div>
              <label className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1 block">
                Name
              </label>
              <Input
                value={newCriteriaName}
                onChange={(e) => setNewCriteriaName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) handleAddCriteria();
                }}
                placeholder={`${activeTab === 'inclusion' ? 'Inclusion' : 'Exclusion'} criteria name`}
                className="h-8 sm:h-9 text-xs sm:text-sm"
                disabled={createCriteria.isPending}
              />
            </div>
            <div>
              <label className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1 block">
                Description
              </label>
              <Textarea
                value={newCriteriaDescription}
                onChange={(e) => setNewCriteriaDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) handleAddCriteria();
                }}
                placeholder="Criteria description (optional)"
                className="text-xs sm:text-sm min-h-[50px] sm:min-h-[60px] resize-none"
                disabled={createCriteria.isPending}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="hidden sm:inline text-xs text-muted-foreground">
                Ctrl+Enter to add
              </span>
              <Button
                size="sm"
                className="h-8 sm:h-9 gap-1 sm:gap-2 text-xs sm:text-sm ml-auto"
                onClick={handleAddCriteria}
                disabled={!newCriteriaName.trim() || createCriteria.isPending}
              >
                <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Add Criteria</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="w-[90vw] sm:w-full max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Delete Criteria
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Are you sure you want to delete this criteria? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false);
                setCriteriaToDelete(null);
              }}
              className="bg-transparent m-0 w-full sm:w-auto"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-white hover:bg-destructive/90 m-0 w-full sm:w-auto"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
