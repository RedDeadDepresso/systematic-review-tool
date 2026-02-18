import { ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ArticleViewLayout } from '@/types/reference';

type SortField = 'title' | 'date' | 'author';
type SortDirection = 'asc' | 'desc';

interface SortDropdownProps {
  field: SortField;
  label: string;
  currentField: SortField | null;
  currentDirection: SortDirection;
  onSort: (field: SortField, direction: SortDirection) => void;
}

function SortDropdown({
  field,
  label,
  currentField,
  currentDirection,
  onSort,
}: SortDropdownProps) {
  const isActive = currentField === field;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors">
          <span>{label}</span>
          {isActive ? (
            currentDirection === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-primary" />
            ) : (
              <ArrowDown className="h-3 w-3 text-primary" />
            )
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => onSort(field, 'asc')}
          className={cn(isActive && currentDirection === 'asc' && 'bg-accent')}
        >
          <ArrowUp className="h-4 w-4 mr-2" />
          Ascending
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSort(field, 'desc')}
          className={cn(isActive && currentDirection === 'desc' && 'bg-accent')}
        >
          <ArrowDown className="h-4 w-4 mr-2" />
          Descending
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface TableSubHeaderProps {
  allSelected: boolean;
  onSelectAll: () => void;
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  viewLayout: ArticleViewLayout;
}

export function TableSubHeader({
  allSelected,
  onSelectAll,
  sortField,
  sortDirection,
  onSortChange,
  viewLayout,
}: TableSubHeaderProps) {
  return (
    <div className="flex items-center px-3 sm:px-6 py-3 border-b border-border bg-muted/50 text-sm font-medium text-muted-foreground">
      <div className="flex items-center gap-3 w-10">
        <Checkbox checked={allSelected} onCheckedChange={onSelectAll} />
      </div>

      {viewLayout === 'title-abstract' ? (
        <span>All references</span>
      ) : (
        <>
          <div className="w-6 sm:w-10" />
          <div className="flex-1 min-w-0">
            <SortDropdown
              field="title"
              label="Title"
              currentField={sortField}
              currentDirection={sortDirection}
              onSort={onSortChange}
            />
          </div>
          <div className="hidden sm:block w-28">
            <SortDropdown
              field="date"
              label="Date"
              currentField={sortField}
              currentDirection={sortDirection}
              onSort={onSortChange}
            />
          </div>
          <div className="hidden md:block w-32">
            <SortDropdown
              field="author"
              label="Author"
              currentField={sortField}
              currentDirection={sortDirection}
              onSort={onSortChange}
            />
          </div>
          {viewLayout === 'title-file' && (
            <>
              <div className="hidden sm:block w-28">
                <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <span>Full Text</span>
                </button>
              </div>
              <div className="w-48 invisible">
                <span>Buttons</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
