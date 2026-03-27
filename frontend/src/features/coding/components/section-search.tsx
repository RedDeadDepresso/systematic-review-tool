// Search input for filtering themes and codes by text.
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { ExpandCollapseButtons } from '@/features/coding/components/expand-collapse-buttons';

interface SectionSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

export function SectionSearch({
  value,
  onChange,
  placeholder = 'Search...',
  compact = false,
  onExpandAll,
  onCollapseAll,
}: SectionSearchProps) {
  return (
    <div className="space-y-1">
      <div className="relative">
        <Search
          className={`absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground ${compact ? 'h-3 w-3' : 'h-4 w-4'}`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${compact ? 'h-7 text-xs pl-7 pr-2' : 'h-8 text-sm pl-8 pr-3'}`}
        />
      </div>
      {onExpandAll && onCollapseAll && (
        <div className="flex justify-end">
          <ExpandCollapseButtons
            onExpandAll={onExpandAll}
            onCollapseAll={onCollapseAll}
            compact={compact}
          />
        </div>
      )}
    </div>
  );
}
