'use client';

import React from 'react';

import { useState, useMemo } from 'react';
import { X, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface LabelPopoverProps {
  trigger: React.ReactNode;
  selectedReferenceIds: number[];
  onLabelsApplied?: () => void;
}

export function LabelPopover({
  trigger,
  selectedReferenceIds,
  onLabelsApplied,
}: LabelPopoverProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const data = { labels: [] };

  const labels = data?.labels || [];

  const filteredLabels = useMemo(() => {
    if (!searchQuery.trim()) return labels;
    return labels.filter((label) =>
      label.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [labels, searchQuery]);

  const showCreateOption = useMemo(() => {
    if (!searchQuery.trim()) return false;
    const exactMatch = labels.some(
      (l) => l.name.toLowerCase() === searchQuery.trim().toLowerCase()
    );
    return !exactMatch;
  }, [labels, searchQuery]);

  const handleLabelToggle = (labelId: number) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleCreateLabel = async () => {
    if (!searchQuery.trim()) return;

    // try {

    //   }
    // } catch (error) {
    //   console.error('Failed to create label:', error);
    // }
  };

  const handleApply = async () => {
    if (selectedReferenceIds.length === 0 || selectedLabelIds.length === 0)
      return;

    setIsApplying(true);
    // try {
    //   }
    // } catch (error) {
    //   console.error('Failed to apply labels:', error);
    // } finally {
    //   setIsApplying(false);
    // }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSelectedLabelIds([]);
      setSearchQuery('');
    }
  };

  const isApplyDisabled =
    selectedLabelIds.length === 0 ||
    selectedReferenceIds.length === 0 ||
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
                    checked={selectedLabelIds.includes(label.id)}
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

          {/* Search input */}
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
