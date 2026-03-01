import * as React from 'react';
import { IconDotsVertical } from '@tabler/icons-react';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type {
  ReviewMember,
  ReviewRole,
} from '@/features/reviews/types/reviews';
import {
  useDeleteReviewMember,
  useUpdateReviewMember,
} from '@/features/reviews/hooks/use-review-members';
import { can } from '@/lib/permissions';
import {
  DataTable,
  DataTableColumnToggle,
  DataTableSortHeader,
} from '@/components/blocks/data-table';
import InvitationDialog from '@/features/reviews/components/review-invitations/invitation-dialog';
import { UserPlus } from 'lucide-react';

export function createColumns(
  userRole: ReviewRole,
  onUpdateRole: (memberId: number, role: ReviewRole) => void,
  onDelete: (memberId: number) => void
): ColumnDef<ReviewMember>[] {
  return [
    {
      id: 'name',
      accessorFn: (row) => `${row.user.firstName} ${row.user.lastName}`,
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Name" />
      ),
      cell: ({ row }) => {
        const user = row.original.user;
        const initials =
          `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
        const fullName = `${user.firstName} ${user.lastName}`;
        return (
          <div className="flex items-center gap-3 pl-4">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={fullName}
                className="size-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {initials}
              </div>
            )}
            <span>{fullName}</span>
          </div>
        );
      },
      enableHiding: false,
    },
    {
      id: 'email',
      accessorFn: (row) => row.user.email,
      enableGlobalFilter: true,
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Email" />
      ),
      cell: ({ row }) => (
        <a
          href={`mailto:${row.original.user.email}`}
          className="hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.user.email}
        </a>
      ),
    },
    {
      accessorKey: 'role',
      header: ({ column }) => (
        <DataTableSortHeader column={column} label="Role" />
      ),
      cell: ({ row }) => {
        const member = row.original;
        if (can('modifyReview', userRole) && member.role !== 'Owner') {
          return (
            <div className="flex justify-center">
              <Select
                value={member.role}
                onValueChange={(value: ReviewRole) =>
                  onUpdateRole(member.id, value)
                }
              >
                <SelectTrigger
                  className="w-32 text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Collaborator">Collaborator</SelectItem>
                  <SelectItem value="Reviewer">Reviewer</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        }
        return <span>{member.role}</span>;
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
        const member = row.original;

        return (
          <>
            {can('modifyReview', userRole) && member.role !== 'Owner' && (
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
                        This will remove {member.user.firstName}{' '}
                        {member.user.lastName} from the review team. This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90 text-white"
                        onClick={() => {
                          onDelete(member.id);
                          setShowDeleteDialog(false);
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </>
        );
      },
    },
  ];
}

export function ReviewMembersTable({
  reviewId,
  data,
  userRole,
  isLoading = false,
}: {
  reviewId: number;
  data: ReviewMember[];
  userRole: ReviewRole;
  isLoading?: boolean;
}) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const updateMember = useUpdateReviewMember();
  const deleteMember = useDeleteReviewMember();
  const [openInvitationDialog, setOpenInvitationDialog] = React.useState(false);

  const onUpdateRole = (memberId: number, role: ReviewRole) => {
    updateMember.mutate({ id: memberId, reviewId, payload: { role } });
  };

  const onDelete = (memberId: number) => {
    deleteMember.mutate({ id: memberId, reviewId });
  };

  const columns = React.useMemo(
    () => createColumns(userRole, onUpdateRole, onDelete),
    [userRole]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: 'includesString',
  });

  return (
    <DataTable
      table={table}
      columns={columns}
      isLoading={isLoading}
      emptyMessage="No team members."
      toolbar={
        <Input
          placeholder="Search by name or email..."
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
      }
      toolbarActions={
        <>
          {can('modifyReview', userRole) && (
            <>
              <InvitationDialog
                reviewId={reviewId}
                open={openInvitationDialog}
                onOpenChange={setOpenInvitationDialog}
              />
              <Button size="sm" onClick={() => setOpenInvitationDialog(true)}>
                <UserPlus />
                <span className="hidden lg:inline">Invite</span>
              </Button>
            </>
          )}
          <DataTableColumnToggle table={table} />
        </>
      }
    />
  );
}
