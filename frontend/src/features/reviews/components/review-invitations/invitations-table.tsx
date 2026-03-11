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
import { Check, X, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DataTable, DataTableSortHeader } from '@/components/blocks/data-table';
import type { Invitation } from '@/features/reviews/types/invitations';
import {
  useAcceptInvitation,
  useDeclineInvitation,
  useDeleteInvitation,
} from '@/features/reviews/hooks/use-review-invitations';
import { capitalize } from '@/lib/capitalize';

// ---------------------------------------------------------------------------
// Shared table hook
// ---------------------------------------------------------------------------

function useInvitationTable(
  data: Invitation[],
  columns: ColumnDef<Invitation>[]
) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);

  return useReactTable({
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
}

// ---------------------------------------------------------------------------
// ReceivedInvitationsTable
// ---------------------------------------------------------------------------

function ReceivedInvitationActions({ invitation }: { invitation: Invitation }) {
  const acceptInvitation = useAcceptInvitation();
  const declineInvitation = useDeclineInvitation();
  const isPending = acceptInvitation.isPending || declineInvitation.isPending;

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        size="sm"
        disabled={isPending}
        className="gap-1.5 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
        onClick={() => acceptInvitation.mutate(invitation.id)}
      >
        <Check className="h-3.5 w-3.5" />
        Accept
      </Button>
      <Button
        size="sm"
        disabled={isPending}
        className="gap-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
        onClick={() => declineInvitation.mutate(invitation.id)}
      >
        <X className="h-3.5 w-3.5" />
        Decline
      </Button>
    </div>
  );
}

function createReceivedColumns(): ColumnDef<Invitation>[] {
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
      accessorKey: 'role',
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Role" />
      ),
      cell: ({ row }) => capitalize(row.original.role),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <ReceivedInvitationActions invitation={row.original} />
      ),
    },
  ];
}

const receivedColumns = createReceivedColumns();

export function ReceivedInvitationsTable({
  data,
  isLoading = false,
}: {
  data: Invitation[];
  isLoading?: boolean;
}) {
  const table = useInvitationTable(data, receivedColumns);

  return (
    <DataTable
      table={table}
      columns={receivedColumns}
      isLoading={isLoading}
      showPagination={false}
    />
  );
}

// ---------------------------------------------------------------------------
// SentInvitationsTable
// ---------------------------------------------------------------------------

function DeleteInvitationCell({ invitation }: { invitation: Invitation }) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const deleteInvitation = useDeleteInvitation();

  return (
    <>
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive-foreground"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the invitation sent to{' '}
              <span className="font-medium text-foreground">
                {invitation.email}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteInvitation.mutate(invitation.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function createSentColumns(): ColumnDef<Invitation>[] {
  return [
    {
      accessorKey: 'review',
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Review" />
      ),
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Sent To" />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Created At" />
      ),
    },
    {
      accessorKey: 'role',
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Role" />
      ),
      cell: ({ row }) => capitalize(row.original.role),
    },
    {
      id: 'actions',
      cell: ({ row }) => <DeleteInvitationCell invitation={row.original} />,
    },
  ];
}

const sentColumns = createSentColumns();

export function SentInvitationsTable({
  data,
  isLoading = false,
}: {
  data: Invitation[];
  isLoading?: boolean;
}) {
  const columns = sentColumns;
  const table = useInvitationTable(data, columns);

  return (
    <DataTable
      table={table}
      columns={columns}
      isLoading={isLoading}
      showPagination={false}
    />
  );
}
