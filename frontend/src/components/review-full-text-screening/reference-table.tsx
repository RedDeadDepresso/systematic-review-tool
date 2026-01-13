import * as React from 'react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowUpDown, ChevronDown } from 'lucide-react';
import type { Opinion, Reference } from '@/types/reference';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { highlightText } from '@/components/review-screening/highlight-text';
import { ReferenceDialog } from './pdf-dialog';
import { DecisionButtons } from '../review-screening/decision-buttons';

const columns: ColumnDef<Reference>[] = [
  {
    accessorKey: 'title',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Title
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    enableHiding: false,
  },
  {
    accessorKey: 'authors',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Authors
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
];

function normalizeOpinions(opinions: Opinion[] | undefined) {
  if (!opinions) return [];
  return Array.isArray(opinions) ? opinions : [opinions];
}

function getFilenameFromUrl(url: string) {
  return url.split('/').pop() || '';
}

export function ReferenceTable({
  reviewId,
  data,
  selectedReference,
  setSelectedReference,
  statusFilter,
  setStatusFilter,
  selectedIncludeKeywords,
  selectedExcludeKeywords,
}: {
  reviewId: number;
  data: Reference[];
  selectedReference: number | null;
  setSelectedReference: (index: number | null) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  selectedIncludeKeywords: string[];
  selectedExcludeKeywords: string[];
}) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [openPdfDialog, setOpenPdfDialog] = React.useState(false);

  const table = useReactTable<Reference>({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
      columnFilters,
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const statuses = ['All', 'Undecided', 'Excluded', 'Maybe', 'Included'];

  return (
    <>
      {/* Header */}
      <div className="border-r border-gray-200 flex flex-col w-full">
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Checkbox id="select-all" />

            {/* Dropdown for filter options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-xs text-muted-foreground font-medium flex items-center gap-1"
                >
                  {statusFilter}
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {statuses.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);

                      setColumnFilters(
                        status === 'All'
                          ? []
                          : [{ id: 'status', value: status }]
                      );
                    }}
                  >
                    {status}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* --- Sort Dropdown --- */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-xs text-muted-foreground font-medium flex items-center gap-1 ml-auto"
                >
                  Sort by
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => {
                    setSorting([{ id: 'authors', desc: false }]);
                  }}
                >
                  Author (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSorting([{ id: 'authors', desc: true }]);
                  }}
                >
                  Author (Z-A)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSorting([{ id: 'title', desc: false }]);
                  }}
                >
                  Title (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSorting([{ id: 'title', desc: true }]);
                  }}
                >
                  Title (Z-A)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* references List */}
        {openPdfDialog &&
          selectedReference !== null &&
          data[selectedReference].file && (
            <ReferenceDialog
              referenceId={data[selectedReference].id}
              open={!!openPdfDialog}
              onOpenChange={(open) => !open && setOpenPdfDialog(false)}
              title={data[selectedReference].title}
              fileUrl={data[selectedReference].file}
            />
          )}
        <div className="flex-1 overflow-y-auto">
          {table.getRowModel().rows.map((row) => {
            const opinions = normalizeOpinions(row.original.opinions);

            return (
              <div
                key={row.index}
                onClick={() => setSelectedReference(row.index)}
                onDoubleClick={() => {
                  row.original.file && setOpenPdfDialog(true);
                }}
                className={`
        cursor-pointer 
        border-b border-border 
        p-4 
        transition-colors 
        ${selectedReference === row.index ? 'bg-muted' : 'hover:bg-accent'}
      `}
              >
                <div className="flex items-start gap-3">
                  <Checkbox className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-gray-400 w-5">
                        {row.index}
                      </span>
                      <div className="flex-1">
                        {/* Title */}
                        <p className="text-sm font-medium leading-snug">
                          {highlightText(
                            row.original.title,
                            selectedIncludeKeywords,
                            selectedExcludeKeywords
                          )}
                        </p>

                        {/* Authors */}
                        <p className="text-xs text-muted-foreground">
                          {row.original.authors}
                        </p>

                        {/* File */}
                        {row.original.file && (
                          <p className="text-xs text-muted-foreground">
                            {getFilenameFromUrl(row.original.file)}
                          </p>
                        )}

                        {/* ALL opinion badges */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {opinions.map((op, idx) => (
                            <Badge
                              key={idx}
                              className={`flex items-center gap-1 ${
                                op.status === 'Included'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : op.status === 'Maybe'
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    : op.status === 'Excluded'
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-gray-50 text-gray-600 border-gray-200'
                              }`}
                            >
                              {op.status === 'Included' && '✓'}
                              {op.status === 'Maybe' && '?'}
                              {op.status === 'Excluded' && '✕'}
                              <span>{op.reviewer}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t p-3">
          <DecisionButtons
            reviewId={reviewId}
            reference={
              selectedReference !== null ? data[selectedReference] : null
            }
          />
        </div>
      </div>
    </>
  );
}
