'use client';

import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useFetchReasons, useCreateReason } from '@/hooks/use-reason';
import type { Reason } from '@/types/reason';
import { toast } from 'sonner';

interface ReasonPopoverProps {
  reviewId: number;
  trigger: React.ReactNode;
  handleReasonApplied: (reasonId: number | null) => void;
}

export function ReasonPopover({
  reviewId,
  trigger,
  handleReasonApplied,
}: ReasonPopoverProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReasonId, setSelectedReasonId] = useState<number | null>(null);

  const { data: reasons = [], refetch } = useFetchReasons({ reviewId });
  const createReasonMutation = useCreateReason();

  /* ---------- filter reasons ---------- */
  const filteredReasons = useMemo(() => {
    if (!searchQuery.trim()) return reasons;
    return reasons.filter((r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [reasons, searchQuery]);

  /* ---------- show create option ---------- */
  const showCreateOption = useMemo(() => {
    if (!searchQuery.trim()) return false;
    const exactMatch = reasons.some(
      (r) => r.name.toLowerCase() === searchQuery.trim().toLowerCase()
    );
    return !exactMatch;
  }, [reasons, searchQuery]);

  /* ---------- create reason ---------- */
  const handleCreateReason = async () => {
    const name = searchQuery.trim();
    if (!name) return;

    try {
      const newReason: Reason = await createReasonMutation.mutateAsync({
        reviewId,
        payload: { name },
      });

      toast.success(`Reason "${newReason.name}" created`);
      setSelectedReasonId(newReason.id);
      setSearchQuery('');
      refetch();
    } catch {
      toast.error('Failed to create reason');
    }
  };

  /* ---------- apply reason ---------- */
  const handleApply = () => {
    handleReasonApplied(selectedReasonId);
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSelectedReasonId(null);
      setSearchQuery('');
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Reasons</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Reason list */}
          <div className="max-h-60 overflow-y-auto px-4 py-2">
            <RadioGroup
              value={selectedReasonId?.toString()}
              onValueChange={(v) => setSelectedReasonId(Number(v))}
            >
              {filteredReasons.map((reason) => (
                <div key={reason.id} className="flex items-center gap-3 py-2">
                  <RadioGroupItem
                    value={reason.id.toString()}
                    id={`reason-${reason.id}`}
                  />
                  <label
                    htmlFor={`reason-${reason.id}`}
                    className="text-sm cursor-pointer"
                  >
                    {reason.name}
                  </label>
                </div>
              ))}
            </RadioGroup>

            {/* Create option */}
            {showCreateOption && (
              <div
                onClick={handleCreateReason}
                className="flex items-center gap-3 py-2 cursor-pointer hover:bg-muted/50"
              >
                <span className="text-sm">Create "{searchQuery.trim()}"</span>
              </div>
            )}

            {filteredReasons.length === 0 && !showCreateOption && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No reasons found
              </div>
            )}
          </div>

          {/* Search + Apply */}
          <div className="p-4 border-t border-border">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or create reason..."
              className="mb-3"
            />
            <Button
              onClick={handleApply}
              disabled={selectedReasonId === null}
              className="w-full"
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
