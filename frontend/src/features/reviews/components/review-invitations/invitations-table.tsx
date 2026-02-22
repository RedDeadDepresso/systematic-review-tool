import * as React from 'react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { DataTable, DataTableSortHeader } from '@/components/shared/data-table';
import type { Invitation } from '@/features/reviews/types/invitations';
import { useUpdateInvitationStatus } from '@/features/reviews/hooks/use-invitations';

function createColumns(
  updateInvitationStatus: ReturnType<typeof useUpdateInvitationStatus>
): ColumnDef<Invitation>[] {
  return [
    {
      accessorKey: 'review',
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Review" />
      ),
    },
    {
      accessorKey: 'invitedBy',
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Invited By" />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Created At" />
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2 justify-center">
          <Button
            onClick={() =>
              updateInvitationStatus.mutate({
                inviteId: row.original.id,
                action: 'accept',
              })
            }
          >
            Accept
          </Button>
          <Button
            variant="destructive"
            className="hover:bg-red-600"
            onClick={() =>
              updateInvitationStatus.mutate({
                inviteId: row.original.id,
                action: 'decline',
              })
            }
          >
            Decline
          </Button>
        </div>
      ),
    },
  ];
}

export function InvitationsTable({
  data,
  isLoading = false,
}: {
  data: Invitation[];
  isLoading?: boolean;
}) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const updateInvitationStatus = useUpdateInvitationStatus();
  const columns = React.useMemo(
    () => createColumns(updateInvitationStatus),
    [updateInvitationStatus]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <DataTable
      table={table}
      columns={columns}
      isLoading={isLoading}
      showPagination={false}
    />
  );
}
