// Buttons to expand or collapse all theme groups at once.
import { Button } from '@/components/ui/button';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

interface ExpandCollapseButtonsProps {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  compact?: boolean;
}

export function ExpandCollapseButtons({
  onExpandAll,
  onCollapseAll,
  compact = false,
}: ExpandCollapseButtonsProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={onExpandAll}
        className={compact ? 'h-6 px-2 text-xs' : 'h-7 px-2 text-xs'}
        title="Expand all"
      >
        <ChevronsUpDown
          className={compact ? 'h-3 w-3 mr-1' : 'h-3.5 w-3.5 mr-1'}
        />
        {!compact && 'Expand'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCollapseAll}
        className={compact ? 'h-6 px-2 text-xs' : 'h-7 px-2 text-xs'}
        title="Collapse all"
      >
        <ChevronsDownUp
          className={compact ? 'h-3 w-3 mr-1' : 'h-3.5 w-3.5 mr-1'}
        />
        {!compact && 'Collapse'}
      </Button>
    </div>
  );
}
