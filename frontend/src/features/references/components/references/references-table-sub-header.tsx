import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ArticleViewLayout } from '@/features/references/types/references';
import type { OrderingField } from '@/features/references/api/references';

// ── Helpers ────────────────────────────────────────────────────────────────────

type OrderingBase = 'title' | 'authors' | 'publication_date';

function baseField(ordering: OrderingField): OrderingBase {
  return ordering.replace(/^-/, '') as OrderingBase;
}

function isDesc(ordering: OrderingField): boolean {
  return ordering.startsWith('-');
}

// ── SortDropdown ───────────────────────────────────────────────────────────────

interface SortDropdownProps {
  field: OrderingBase;
  label: string;
  currentOrdering: OrderingField;
  onSelect: (ordering: OrderingField) => void;
}

function SortDropdown({
  field,
  label,
  currentOrdering,
  onSelect,
}: SortDropdownProps) {
  const active = baseField(currentOrdering) === field;
  const desc = isDesc(currentOrdering);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors group">
          <span>{label}</span>
          {active ? (
            desc ? (
              <ArrowDown className="h-3 w-3 text-primary" />
            ) : (
              <ArrowUp className="h-3 w-3 text-primary" />
            )
          ) : (
            <ChevronsUpDown className="h-3 w-3 opacity-40 group-hover:opacity-70 transition-opacity" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        <DropdownMenuItem
          onClick={() => onSelect(field as OrderingField)}
          className={cn(active && !desc && 'bg-accent font-medium')}
        >
          <ArrowUp className="h-4 w-4 mr-2 flex-shrink-0" />
          Ascending
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSelect(`-${field}` as OrderingField)}
          className={cn(active && desc && 'bg-accent font-medium')}
        >
          <ArrowDown className="h-4 w-4 mr-2 flex-shrink-0" />
          Descending
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── TableSubHeader ─────────────────────────────────────────────────────────────

interface TableSubHeaderProps {
  allSelected: boolean;
  onSelectAll: () => void;
  ordering: OrderingField;
  onOrderingChange: (ordering: OrderingField) => void;
  viewLayout: ArticleViewLayout;
}

export function TableSubHeader({
  allSelected,
  onSelectAll,
  ordering,
  onOrderingChange,
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
              currentOrdering={ordering}
              onSelect={onOrderingChange}
            />
          </div>

          <div className="hidden sm:block w-28">
            <SortDropdown
              field="publication_date"
              label="Date"
              currentOrdering={ordering}
              onSelect={onOrderingChange}
            />
          </div>

          <div className="hidden md:block w-32">
            <SortDropdown
              field="authors"
              label="Author"
              currentOrdering={ordering}
              onSelect={onOrderingChange}
            />
          </div>

          {viewLayout === 'title-file' && (
            <>
              <div className="hidden sm:block w-28">
                <span>Full Text</span>
              </div>
              <div className="w-48 invisible" aria-hidden>
                <span>Buttons</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
