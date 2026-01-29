'use client';

import React, { useState, useMemo } from 'react';
import { Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useFetchReview } from '@/hooks/use-review';
import { useAssignReferences } from '@/hooks/use-reference';
import type { User } from '@/types/auth';

interface AssigneePopoverProps {
  reviewId: number;
  trigger: React.ReactNode;
  selectedReferenceIds: number[];
  onAssigneeApplied?: () => void;
}

export function AssigneePopover({
  reviewId,
  trigger,
  selectedReferenceIds,
  onAssigneeApplied,
}: AssigneePopoverProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<
    number | 'remove' | 'split' | null
  >(null);
  const [isApplying, setIsApplying] = useState(false);

  const assignReferences = useAssignReferences();
  const { data: review } = useFetchReview(reviewId);

  const assignableUsers = useMemo<User[]>(() => {
    if (!review) return [];

    const users = [review.owner, ...(review.collaborators ?? [])];

    // De-duplicate by id (owner may also be in collaborators)
    const seen = new Map<number, User>();
    users.forEach((u) => {
      if (u) seen.set(u.id, u);
    });

    return Array.from(seen.values());
  }, [review]);

  const filteredCollaborators = useMemo(() => {
    if (!searchQuery.trim()) return assignableUsers;

    return assignableUsers.filter((u) =>
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [assignableUsers, searchQuery]);

  const handleApply = async () => {
    if (selectedReferenceIds.length === 0 || selectedAssigneeId === null)
      return;

    setIsApplying(true);
    try {
      if (selectedAssigneeId === 'remove') {
        await assignReferences.mutateAsync({
          review: reviewId,
          referenceIds: selectedReferenceIds,
          mode: 'remove',
        });
      } else if (selectedAssigneeId === 'split') {
        await assignReferences.mutateAsync({
          review: reviewId,
          referenceIds: selectedReferenceIds,
          mode: 'split_equally',
        });
      } else {
        await assignReferences.mutateAsync({
          review: reviewId,
          referenceIds: selectedReferenceIds,
          mode: 'assign',
          assigneeId: selectedAssigneeId,
        });
      }
      onAssigneeApplied?.();
      setOpen(false);
    } finally {
      setIsApplying(false);
    }
  };

  const handleOpenChange = (state: boolean) => {
    setOpen(state);
    if (!state) {
      setSearchQuery('');
      setSelectedAssigneeId(null);
    }
  };

  const isApplyDisabled =
    !selectedAssigneeId || selectedReferenceIds.length === 0 || isApplying;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex flex-col">
          <RadioGroup>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Assign references</h3>
              <button onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Collaborators */}
            <div className="max-h-60 overflow-y-auto border-b">
              {filteredCollaborators.map((collaborator: User) => (
                <div
                  key={collaborator.id}
                  onClick={() => setSelectedAssigneeId(collaborator.id)}
                  className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted/50"
                >
                  <RadioGroupItem
                    value={String(collaborator.id)}
                    checked={selectedAssigneeId === collaborator.id}
                    tabIndex={-1}
                    aria-label={collaborator.displayName}
                    className="pointer-events-none"
                  />
                  <span className="text-sm truncate">
                    {collaborator.displayName}
                    {review?.owner?.id === collaborator.id && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (Owner)
                      </span>
                    )}
                  </span>
                </div>
              ))}

              {filteredCollaborators.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No collaborators found
                </div>
              )}
            </div>

            {/* Special actions */}
            <div>
              <div
                onClick={() => setSelectedAssigneeId('split')}
                className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted/50"
              >
                <RadioGroupItem
                  value="split"
                  checked={selectedAssigneeId === 'split'}
                  tabIndex={-1}
                  aria-label="Split equally"
                  className="pointer-events-none"
                />
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Split equally (automatic)</span>
              </div>
              <div
                onClick={() => setSelectedAssigneeId('remove')}
                className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted/50"
              >
                <RadioGroupItem
                  value="remove"
                  checked={selectedAssigneeId === 'remove'}
                  tabIndex={-1}
                  aria-label="Remove assignee"
                  className="pointer-events-none"
                />
                <X className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">
                  Remove assignee
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search collaborator..."
                className="mb-3"
              />
              <Button
                onClick={handleApply}
                disabled={isApplyDisabled}
                className="w-full"
              >
                {isApplying ? 'Applying...' : 'Apply'}
              </Button>
            </div>
          </RadioGroup>
        </div>
      </PopoverContent>
    </Popover>
  );
}
