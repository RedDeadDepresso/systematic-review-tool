import * as React from 'react';
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconChevronDown,
  IconLayoutColumns,
} from '@tabler/icons-react';
import {
  type ColumnDef,
  flexRender,
  type Row,
  type Table as TanstackTable,
} from '@tanstack/react-table';

import { ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ---------------------------------------------------------------------------
// useIsMobile
// ---------------------------------------------------------------------------

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = React.useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}

// ---------------------------------------------------------------------------
// DataTableColumnToggle
// ---------------------------------------------------------------------------

interface DataTableColumnToggleProps<TData> {
  table: TanstackTable<TData>;
}

export function DataTableColumnToggle<TData>({
  table,
}: DataTableColumnToggleProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <IconLayoutColumns />
          <span className="hidden lg:inline">Customise Columns</span>
          <span className="lg:hidden">Columns</span>
          <IconChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {table
          .getAllColumns()
          .filter(
            (column) =>
              typeof column.accessorFn !== 'undefined' && column.getCanHide()
          )
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              {column.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// DataTableSortHeader
// ---------------------------------------------------------------------------

interface DataTableSortHeaderProps {
  column: {
    getIsSorted: () => false | 'asc' | 'desc';
    toggleSorting: (desc: boolean) => void;
  };
  label: string;
}

/**
 * Drop-in replacement for the old `<Button variant="ghost">` sort header.
 * Renders a text trigger with a directional arrow when active, or a chevron
 * when inactive. Clicking opens a dropdown with Ascending / Descending options.
 */
export function DataTableSortHeader({
  column,
  label,
}: DataTableSortHeaderProps) {
  const sorted = column.getIsSorted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center justify-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors outline-none">
          <span>{label}</span>
          {sorted === 'asc' ? (
            <ArrowUp className="h-3 w-3 text-primary" />
          ) : sorted === 'desc' ? (
            <ArrowDown className="h-3 w-3 text-primary" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuItem
          onClick={() => column.toggleSorting(false)}
          className={sorted === 'asc' ? 'bg-accent' : ''}
        >
          <ArrowUp className="h-4 w-4 mr-2" />
          Ascending
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => column.toggleSorting(true)}
          className={sorted === 'desc' ? 'bg-accent' : ''}
        >
          <ArrowDown className="h-4 w-4 mr-2" />
          Descending
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// DataTablePagination
// ---------------------------------------------------------------------------

interface DataTablePaginationProps<TData> {
  table: TanstackTable<TData>;
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-end px-4">
      <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
        {/* Rows per page — desktop only */}
        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor="rows-per-page" className="text-sm font-medium">
            Rows per page
          </Label>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger size="sm" className="w-20" id="rows-per-page">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page counter */}
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </div>

        {/* Nav buttons */}
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to first page</span>
            <IconChevronsLeft />
          </Button>
          <Button
            variant="outline"
            className="size-8"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <IconChevronLeft />
          </Button>
          <Button
            variant="outline"
            className="size-8"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <IconChevronRight />
          </Button>
          <Button
            variant="outline"
            className="hidden size-8 lg:flex"
            size="icon"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to last page</span>
            <IconChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Extract a plain-text label from a column's header definition. */
function getColumnLabel<TData>(
  column: ReturnType<TanstackTable<TData>['getAllColumns']>[0]
): string {
  const header = column.columnDef.header;
  if (typeof header === 'string') return header;
  // Convert camelCase / PascalCase id → "Title Case With Spaces"
  // e.g. "dateCreated" → "Date Created", "referenceCount" → "Reference Count"
  return column.id
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// ---------------------------------------------------------------------------
// MobileCardList
// ---------------------------------------------------------------------------

const SKELETON_ROW_COUNT = 5;

interface MobileCardListProps<TData> {
  table: TanstackTable<TData>;
  columns: ColumnDef<TData>[];
  isLoading: boolean;
  onRowClick?: (row: Row<TData>) => void;
  emptyMessage: string;
}

function MobileCardList<TData>({
  table,
  columns,
  isLoading,
  onRowClick,
  emptyMessage,
}: MobileCardListProps<TData>) {
  const labelMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    table.getAllColumns().forEach((col) => {
      map[col.id] = getColumnLabel(col);
    });
    return map;
  }, [table]);

  /* ── Skeleton ── */
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 flex flex-col gap-3">
            {columns.map((_, j) => (
              <div key={j} className="flex flex-col gap-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  /* ── Empty ── */
  const rows = table.getRowModel().rows;
  if (!rows.length) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  /* ── Cards ── */
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div
          key={row.id}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          className={[
            'rounded-lg border bg-card p-4 flex flex-col gap-3 shadow-sm',
            onRowClick
              ? 'cursor-pointer hover:bg-accent/50 transition-colors'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {row.getVisibleCells().map((cell) => {
            /* Actions column — full-width strip at the bottom of the card */
            if (cell.column.id === 'actions') {
              return (
                <div
                  key={cell.id}
                  className="flex justify-end pt-2 border-t"
                  onClick={(e) => e.stopPropagation()}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              );
            }

            return (
              <div key={cell.id} className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {labelMap[cell.column.id] ?? cell.column.id}
                </span>
                <div className="text-sm break-words">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

interface DataTableProps<TData> {
  /** The configured TanStack table instance */
  table: TanstackTable<TData>;
  /** Column definitions — used for skeleton cell count and empty-state colSpan */
  columns: ColumnDef<TData>[];
  /** Show skeleton rows instead of data */
  isLoading?: boolean;
  /** Left side of the toolbar (e.g. search input) */
  toolbar?: React.ReactNode;
  /** Right side of the toolbar (e.g. action buttons, column toggle) */
  toolbarActions?: React.ReactNode;
  /** Called when a data row is clicked */
  onRowClick?: (row: Row<TData>) => void;
  /** Render the pagination footer. Defaults to true. */
  showPagination?: boolean;
  /** Message shown when the table has no rows */
  emptyMessage?: string;
}

export function DataTable<TData>({
  table,
  columns,
  isLoading = false,
  toolbar,
  toolbarActions,
  onRowClick,
  showPagination = true,
  emptyMessage = 'No results.',
}: DataTableProps<TData>) {
  const isMobile = useIsMobile();
  const hasToolbar = toolbar != null || toolbarActions != null;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* ── Toolbar ── */}
      {hasToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1">{toolbar}</div>
          {toolbarActions && (
            <div className="flex shrink-0 items-center gap-2">
              {toolbarActions}
            </div>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <div className="relative flex flex-col gap-4">
        {isMobile ? (
          /* ── Card layout on mobile ── */
          <MobileCardList
            table={table}
            columns={columns}
            isLoading={isLoading}
            onRowClick={onRowClick}
            emptyMessage={emptyMessage}
          />
        ) : (
          /* ── Table layout on desktop ── */
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        className={
                          header.id === 'name' ? 'text-left' : 'text-center'
                        }
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: SKELETON_ROW_COUNT }).map(
                    (_, rowIdx) => (
                      <TableRow key={`skeleton-${rowIdx}`}>
                        {columns.map((_, colIdx) => (
                          <TableCell key={`skeleton-${rowIdx}-${colIdx}`}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  )
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={onRowClick ? 'cursor-pointer' : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={
                            cell.column.id === 'name'
                              ? 'text-left'
                              : 'text-center'
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ── Pagination ── */}
        {showPagination && <DataTablePagination table={table} />}
      </div>
    </div>
  );
}
