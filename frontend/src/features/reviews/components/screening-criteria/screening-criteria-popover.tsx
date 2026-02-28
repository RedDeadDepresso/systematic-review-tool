import React from 'react';

import { useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ScreeningCriteriaContent,
  type ScreeningCriteriaProps,
} from '@/features/reviews/components/screening-criteria/screening-criteria-content';

interface ScreeningCriteriaPopoverProps extends ScreeningCriteriaProps {
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
  // Keyboard shortcut
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

  return (
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
        <ScreeningCriteriaContent
          reviewId={reviewId}
          userRole={userRole}
          onClose={() => onOpenChange(false)}
          showCloseButton
          showKeyboardHint
        />
      </PopoverContent>
    </Popover>
  );
}
