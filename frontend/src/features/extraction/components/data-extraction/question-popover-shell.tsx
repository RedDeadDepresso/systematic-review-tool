import { useRef, useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { PopoverContentProps } from '@radix-ui/react-popover';

const POPOVER_OFFSET = 8;
const VIEWPORT_PADDING = 8;

interface QuestionPopoverShellProps {
  trigger: React.ReactNode;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align?: PopoverContentProps['align'];
  children: React.ReactNode;
}

export function QuestionPopoverShell({
  trigger,
  title,
  open,
  onOpenChange,
  align = 'end',
  children,
}: QuestionPopoverShellProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  const recalculate = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMaxHeight(
      window.innerHeight - rect.bottom - POPOVER_OFFSET - VIEWPORT_PADDING
    );
  }, []);

  // Recalculate on open, and keep recalculating on resize while open
  useEffect(() => {
    if (!open) return;
    recalculate();
    window.addEventListener('resize', recalculate);
    return () => window.removeEventListener('resize', recalculate);
  }, [open, recalculate]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) setMaxHeight(null);
      onOpenChange(isOpen);
    },
    [onOpenChange]
  );

  return (
    <TooltipProvider>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <div ref={triggerRef} className="inline-flex">
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        </div>

        <PopoverContent
          className="w-80 p-0 flex flex-col"
          align={align}
          style={maxHeight ? { maxHeight } : undefined}
        >
          {/* Header – always visible */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <h3 className="font-semibold text-foreground">{title}</h3>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
