import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
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
} from '@/features/references/hooks/use-labels';
import type { Label } from '@/features/references/types/labels';
import { toast } from 'sonner';

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
  const [enabledLabels, setEnabledLabels] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [labelStates, setLabelStates] = useState<Record<number, LabelState>>(
    {}
  );
  const [isApplying, setIsApplying] = useState(false);

  // Fetch labels using hook
  const { data: labels = [], refetch } = useFetchLabels(enabledLabels);
  const createLabelMutation = useCreateLabel();
  const assignLabelsMutation = useAssignLabelsToReferences();

  useMemo(() => {
    if (open && !enabledLabels) {
      setEnabledLabels(true);
    }
  }, [open, enabledLabels]);

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
  const handleApply = async () => {
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
    try {
      await assignLabelsMutation.mutateAsync({
        review: reviewId,
        referenceIds: selectedReferenceIds,
        checkedLabelIds: checkedIds,
        indeterminateLabelIds: indeterminateIds,
      });
      onLabelsApplied?.();
      setOpen(false);
    } finally {
      setIsApplying(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
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
                  <span className="text-sm text-foreground">{label.name}</span>
                </div>
                <button className="text-xs text-muted-foreground hover:text-foreground px-3 py-1 border border-border rounded-md transition-colors">
                  Click to add hotkey
                </button>
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
  );
}
