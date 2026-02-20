'use client';

import React from 'react';

import { useState, useEffect, useRef } from 'react';
import { X, Pencil, Minus, Send, SquareSlash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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

interface ScreeningCriteriaPopoverProps {
  reviewId: number;
  userRole: ReviewRole;
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScreeningCriteriaPopover({
  trigger,
  reviewId,
  userRole,
  open,
  onOpenChange,
}: ScreeningCriteriaPopoverProps) {
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
  const [popoverShouldStayOpen, setPopoverShouldStayOpen] = useState(false);

  const editNameInputRef = useRef<HTMLInputElement>(null);
  const fetchCriteria = useFetchScreeningCriteria({ reviewId: reviewId });
  const createCriteria = useCreateScreeningCriteria();
  const updateCriteria = useUpdateScreeningCriteria();
  const deleteCriteria = useDeleteScreeningCriteria();

  // Keyboard shortcut to open popover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId && editNameInputRef.current) {
      editNameInputRef.current.focus();
    }
  }, [editingId]);

  // Keep popover open when dialog is open
  useEffect(() => {
    if (deleteDialogOpen) {
      setPopoverShouldStayOpen(true);
    }
  }, [deleteDialogOpen]);

  // Prevent popover from closing when it should stay open
  const handleOpenChange = (newOpen: boolean) => {
    if (popoverShouldStayOpen && !newOpen) {
      // Don't close if we want it to stay open
      return;
    }
    onOpenChange(newOpen);
  };

  const inclusionCriteria = fetchCriteria.data
    ? fetchCriteria.data.filter(
        (c: ScreeningCriteria) => c.kind === 'Inclusive'
      )
    : [];
  const exclusionCriteria = fetchCriteria.data
    ? fetchCriteria.data.filter(
        (c: ScreeningCriteria) => c.kind === 'Exclusive'
      )
    : [];
  const currentCriteria =
    activeTab === 'inclusion' ? inclusionCriteria : exclusionCriteria;

  const handleAddCriteria = async () => {
    try {
      if (!newCriteriaName.trim()) return;
      await createCriteria.mutateAsync({
        review: reviewId,
        name: newCriteriaName.trim(),
        description: newCriteriaDescription.trim(),
        kind: activeTab === 'inclusion' ? 'Inclusive' : 'Exclusive',
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
        reviewId: reviewId,
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
        reviewId: reviewId,
      });
      setDeleteDialogOpen(false);
      setCriteriaToDelete(null);
      setPopoverShouldStayOpen(false);
    } catch (error) {
      console.log(error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setCriteriaToDelete(null);
    setPopoverShouldStayOpen(false);
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(val) => {
          if (val) onOpenChange(true);
        }}
      >
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          className="w-full sm:w-[500px] p-0 max-h-[90vh] flex flex-col"
          align="end"
          side="bottom"
          sideOffset={5}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <SquareSlash className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              <span className="text-sm sm:text-base font-semibold">
                Screening Criteria
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => handleOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Keyboard hint - hidden on mobile */}
          <div className="hidden sm:block px-4 py-2 text-xs sm:text-sm text-primary shrink-0">
            Or press "c" on the keyboard to view criteria
          </div>

          {/* Tabs */}
          <div className="px-3 sm:px-4 shrink-0">
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setActiveTab('inclusion')}
                className={cn(
                  'flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors',
                  activeTab === 'inclusion'
                    ? 'bg-background text-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                )}
              >
                Inclusion
              </button>
              <button
                onClick={() => setActiveTab('exclusion')}
                className={cn(
                  'flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors border-l border-border',
                  activeTab === 'exclusion'
                    ? 'bg-background text-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                )}
              >
                Exclusion
              </button>
            </div>
          </div>

          {/* Criteria List - scrollable */}
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
                      {/* Header with Badge */}
                      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded whitespace-nowrap',
                              activeTab === 'inclusion'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            )}
                          >
                            {activeTab === 'inclusion'
                              ? 'Inclusion'
                              : 'Exclusion'}{' '}
                            {index + 1}
                          </span>
                        </div>
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
                              <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Editing Mode */}
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
                        /* Display Mode */
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

                    {/* Separator between items (not after last item) */}
                    {index < currentCriteria.length - 1 && <Separator />}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* Add Criteria Input */}
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
                    disabled={
                      !newCriteriaName.trim() || createCriteria.isPending
                    }
                  >
                    <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Add Criteria</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Delete Confirmation Dialog */}
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
              onClick={handleDeleteCancel}
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
