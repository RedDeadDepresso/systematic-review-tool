// Table listing active or archived reviews with actions.
import * as React from 'react';
import { IconDotsVertical, IconPlus } from '@tabler/icons-react';
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
  type VisibilityState,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Input } from '@/components/ui/input';
import { ReviewFormDialog } from '@/features/reviews/components/reviews/review-form-dialog';
import {
  useCreateReview,
  useDeleteReview,
  useUpdateReview,
} from '@/features/reviews/hooks/use-reviews';
import { useQueryClient } from '@tanstack/react-query';
import type { ReviewRow } from '@/features/reviews/types/reviews';
import { useRouter } from '@tanstack/react-router';
import {
  DataTable,
  DataTableColumnToggle,
  DataTableSortHeader,
} from '@/components/blocks/data-table';
import { useFetchUser } from '@/features/users/hooks/use-auth';
import type { User } from '@/features/users/types/auth';

export function createColumns(
  isActive: boolean,
  onToggleArchive: (rowData: ReviewRow) => void,
  onDelete: (rowData: ReviewRow) => void,
  currentUser?: User
): ColumnDef<ReviewRow>[] {
  return [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Title" />
      ),
      enableHiding: false,
    },
    {
      accessorKey: 'dateCreated',
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Date Created" />
      ),
    },
    {
      accessorKey: 'owner',
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Owner" />
      ),
      cell: ({ getValue }) => {
        const value = getValue<string>();
        return value === currentUser?.displayName || !value ? 'You' : value;
      },
    },
    {
      accessorKey: 'referenceCount',
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="N. of References" />
      ),
      cell: ({ getValue }) => {
        const value = getValue<number>();
        return value ? value : 0;
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
        const sameUser =
          row.original.owner === currentUser?.displayName ||
          !row.original.owner;
        return !sameUser ? null : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
                  size="icon"
                >
                  <IconDotsVertical />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleArchive(row.original);
                  }}
                >
                  {isActive ? 'Archive' : 'Unarchive'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog
              open={showDeleteDialog}
              onOpenChange={setShowDeleteDialog}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete{' '}
                    <span className="font-medium text-foreground">
                      {row.original.title}
                    </span>
                    . This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(row.original);
                      setShowDeleteDialog(false);
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        );
      },
    },
  ];
}

export function ReviewsTable({
  data,
  isActive,
  isLoading = false,
}: {
  data: ReviewRow[];
  isActive: boolean;
  isLoading?: boolean;
}) {
  'use no memo';
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const { data: currentUser } = useFetchUser();
  const createReview = useCreateReview();
  const updateReview = useUpdateReview();
  const [openCreateDialog, setOpenCreateDialog] = React.useState(false);
  const deleteReview = useDeleteReview();
  const queryClient = useQueryClient();
  const router = useRouter();

  const onSubmitCreate = (formData: { title: string; description: string }) => {
    createReview.mutate(formData);
  };

  const onToggleArchive = (rowData: ReviewRow) => {
    updateReview.mutate({ id: rowData.id, payload: { isActive: !isActive } });
    queryClient.setQueryData(['reviews', { isActive }], (old: any = []) =>
      old.filter((r: any) => r.id !== rowData.id)
    );
    queryClient.setQueryData(
      ['reviews', { isActive: !isActive }],
      (old: any = []) => [...old, rowData]
    );
  };

  const onDelete = (rowData: ReviewRow) => {
    deleteReview.mutate({ id: rowData.id });
    queryClient.setQueryData(['reviews', { isActive }], (old: any = []) =>
      old.filter((r: any) => r.id !== rowData.id)
    );
  };

  const columns = React.useMemo(
    () => createColumns(isActive, onToggleArchive, onDelete, currentUser),
    [isActive]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnFilters, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <DataTable
      table={table}
      columns={columns}
      isLoading={isLoading}
      onRowClick={(row) =>
        router.navigate({ to: `/reviews/${row.original.id}` })
      }
      toolbar={
        <Input
          placeholder="Filter reviews..."
          value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
          onChange={(e) =>
            table.getColumn('title')?.setFilterValue(e.target.value)
          }
          className="max-w-sm"
        />
      }
      toolbarActions={
        <>
          <ReviewFormDialog
            dialogTitle="Create Review"
            dialogDescription="Create a new review for this project."
            onSubmit={onSubmitCreate}
            disabled={createReview.isPending}
            open={openCreateDialog}
            onOpenChange={setOpenCreateDialog}
          />
          <Button size="sm" onClick={() => setOpenCreateDialog(true)}>
            <IconPlus />
            <span className="hidden lg:inline">Create Review</span>
          </Button>
          <DataTableColumnToggle table={table} />
        </>
      }
    />
  );
}
