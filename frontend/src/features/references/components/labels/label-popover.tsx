// Popover for assigning labels to a reference.
import React, { useState, useMemo, useEffect } from 'react';
import { MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  useFetchLabels,
  useCreateLabel,
  useAssignLabelsToReferences,
  useDeleteLabel,
} from '@/features/references/hooks/use-labels';
import type { Label } from '@/features/references/types/labels';
import { toast } from 'sonner';
import { LabelEditDialog } from '@/features/references/components/labels/label-edit-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LabelPopoverProps {
  reviewId: number;
  trigger: React.ReactNode;
  selectedReferenceIds: number[];
  onLabelsApplied?: () => void;
}

type LabelState = 'checked' | 'unchecked' | 'indeterminate';

export function LabelPopover({
  reviewId,
  trigger,
  selectedReferenceIds,
  onLabelsApplied,
}: LabelPopoverProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [labelStates, setLabelStates] = useState<Record<number, LabelState>>(
    {}
  );
  const [isApplying, setIsApplying] = useState(false);
  const [editLabel, setEditLabel] = useState<Label | null>(null);

  // Fetch labels using hook
  const { data: labels = [], refetch } = useFetchLabels();
  const createLabelMutation = useCreateLabel();
  const deleteLabelMutation = useDeleteLabel();
  const assignLabelsMutation = useAssignLabelsToReferences();

  // Filter labels based on search
  const filteredLabels = useMemo(() => {
    if (!searchQuery.trim()) return labels;
    return labels.filter((label) =>
      label.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [labels, searchQuery]);

  // Show "create" option if search query doesn't match existing labels
  const showCreateOption = useMemo(() => {
    if (!searchQuery.trim()) return false;
    const exactMatch = labels.some(
      (l) => l.name.toLowerCase() === searchQuery.trim().toLowerCase()
    );
    return !exactMatch;
  }, [labels, searchQuery]);

  // Toggle tri-state checkbox
  const handleLabelToggle = (labelId: number) => {
    setLabelStates((prev) => {
      const current = prev[labelId] ?? 'unchecked';
      const next: LabelState =
        current === 'unchecked'
          ? 'checked'
          : current === 'checked'
            ? 'indeterminate'
            : 'unchecked';
      return { ...prev, [labelId]: next };
    });
  };

  // Create new label
  const handleCreateLabel = async () => {
    const name = searchQuery.trim();
    if (!name) return;

    try {
      const newLabel: Label = await createLabelMutation.mutateAsync({ name });
      toast.success(`Label "${newLabel.name}" created`);
      setLabelStates((prev) => ({ ...prev, [newLabel.id]: 'checked' }));
      setSearchQuery('');
      refetch();
    } catch (error) {
      console.error('Failed to create label:', error);
      toast.error('Failed to create label');
    }
  };

  // Apply labels
  const handleApply = () => {
    const checkedIds = Object.entries(labelStates)
      .filter(([_, state]) => state === 'checked')
      .map(([id]) => Number(id));

    const indeterminateIds = Object.entries(labelStates)
      .filter(([_, state]) => state === 'indeterminate')
      .map(([id]) => Number(id));

    if (
      selectedReferenceIds.length === 0 ||
      Object.keys(labelStates).length === 0
    )
      return;

    setIsApplying(true);
    assignLabelsMutation.mutate(
      {
        review: reviewId,
        referenceIds: selectedReferenceIds,
        checkedLabelIds: checkedIds,
        indeterminateLabelIds: indeterminateIds,
      },
      {
        onSuccess: () => {
          onLabelsApplied?.();
          setOpen(false);
          setIsApplying(false);
        },
        onError: (error) => {
          console.error('Error applying labels: ', error);
          setIsApplying(false);
        },
      }
    );
  };

  useEffect(() => {
    if (!labels.length) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
        return;
      if (selectedReferenceIds.length === 0) return;

      // Build the pressed hotkey string in the same format as stored
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      let key =
        e.key === ' '
          ? 'Space'
          : e.key.length === 1
            ? e.key.toUpperCase()
            : e.key;
      parts.push(key);
      const pressed = parts.join('+');

      const matched = labels.find((l) => l.hotkey === pressed);
      if (!matched) return;

      e.preventDefault();
      setIsApplying(true);
      assignLabelsMutation.mutate(
        {
          review: reviewId,
          referenceIds: selectedReferenceIds,
          checkedLabelIds: [matched.id],
          indeterminateLabelIds: [],
        },
        {
          onSuccess: () => {
            onLabelsApplied?.();
            setOpen(false);
            setIsApplying(false);
          },
          onError: (error) => {
            console.error('Error applying labels: ', error);
            setIsApplying(false);
          },
        }
      );
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [labels, selectedReferenceIds]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && editLabel) {
      setOpen(true);
    } else {
      setOpen(isOpen);
    }
    if (!isOpen) {
      setLabelStates({});
      setSearchQuery('');
    }
  };

  const isApplyDisabled =
    selectedReferenceIds.length === 0 ||
    Object.keys(labelStates).length === 0 ||
    isApplying;

  return (
    <>
      {editLabel && (
        <LabelEditDialog
          label={editLabel}
          open={!!editLabel}
          onOpenChange={() => setEditLabel(null)}
          onSuccess={onLabelsApplied}
        />
      )}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Labels</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Labels list */}
            <div className="max-h-60 overflow-y-auto">
              {filteredLabels.map((label) => (
                <div
                  key={label.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={
                        labelStates[label.id] === 'checked'
                          ? true
                          : labelStates[label.id] === 'indeterminate'
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={() => handleLabelToggle(label.id)}
                    />
                    {/* Colour dot + name */}
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="text-sm text-foreground">
                      {label.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Hotkey badge */}
                    <button className="text-xs hover:text-foreground px-3 py-1 border rounded-md transition-colors">
                      {label.hotkey || '—'}
                    </button>

                    {/* Three-dot menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          // Prevent the popover from closing when clicking the trigger
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditLabel(label);
                            handleOpenChange(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLabelMutation.mutate(label.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}

              {/* Create new label option */}
              {showCreateOption && (
                <div
                  onClick={handleCreateLabel}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <Checkbox checked={false} />
                  <span className="text-sm text-foreground">
                    Create "{searchQuery.trim()}"
                  </span>
                </div>
              )}

              {filteredLabels.length === 0 && !showCreateOption && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No labels found
                </div>
              )}
            </div>

            {/* Search input & Apply button */}
            <div className="p-4 border-t border-border">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search or create label..."
                className="mb-3"
              />
              <Button
                onClick={handleApply}
                disabled={isApplyDisabled}
                className="w-full bg-[#2d6a7a] hover:bg-[#245a68] text-white"
              >
                {isApplying ? 'Applying...' : 'Apply'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
