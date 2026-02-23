import {
  ChevronDown,
  FileText,
  Trash2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type {
  DuplicateStatusCounts,
  SearchMethod,
} from '@/features/references/api/references';
import type { ReviewRole } from '@/features/reviews/types/reviews';
import { can } from '@/lib/permissions';
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
import { useState } from 'react';

interface SourcesSidebarProps {
  reviewId: number;
  searchMethods: SearchMethod[];
  userRole: ReviewRole;
  selectedSearchMethodIds: number[];
  onSearchMethodToggle: (id: number) => void;
  onSelectAllReferences: () => void;
  duplicateStatusCounts: DuplicateStatusCounts;
  selectedDuplicateStatuses: string[];
  onDuplicateStatusToggle: (status: string) => void;
  totalReferences: number;
  isCollapsed: boolean;
  onAddReferences: () => void;
  onDetectDuplicates: () => void;
  onResolveDuplicates: () => void;
  onDeleteSearchMethod?: (searchMethod: SearchMethod) => void;
}

export function SourcesSidebar({
  searchMethods,
  userRole,
  selectedSearchMethodIds,
  onSearchMethodToggle,
  onSelectAllReferences,
  duplicateStatusCounts,
  selectedDuplicateStatuses,
  onDuplicateStatusToggle,
  totalReferences,
  isCollapsed,
  onAddReferences,
  onDetectDuplicates,
  onResolveDuplicates,
  onDeleteSearchMethod,
}: SourcesSidebarProps) {
  const duplicateStatuses = [
    { key: 'Unresolved', icon: Clock, label: 'Unresolved' },
    { key: 'Deleted', icon: Trash2, label: 'Deleted' },
    { key: 'Not Duplicate', icon: XCircle, label: 'Not Duplicate' },
    { key: 'Resolved', icon: CheckCircle, label: 'Resolved' },
  ];
  const [deleteConfirmSearchMethod, setDeleteConfirmSearchMethod] =
    useState<SearchMethod | null>(null);

  return (
    <aside
      className={cn(
        'w-56 sm:w-64 border-r border-border flex flex-col h-full',
        isCollapsed && 'hidden'
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <h2 className="text-sm font-medium text-sidebar-foreground">
          All Data
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Imported References Section */}
        <Collapsible defaultOpen className="border-b border-sidebar-border">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-sidebar-accent transition-colors group">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Imported References</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pb-3">
              {/* All References */}
              <button
                onClick={onSelectAllReferences}
                className={cn(
                  'flex items-center justify-between w-full px-4 py-2 text-sm hover:bg-sidebar-accent transition-colors',
                  selectedSearchMethodIds.length === 0 &&
                    'bg-sidebar-accent text-sidebar-accent-foreground'
                )}
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  All References
                </span>
                <span className="text-muted-foreground">{totalReferences}</span>
              </button>

              {/* Search Methods */}
              {searchMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => onSearchMethodToggle(method.id)}
                  className={cn(
                    'flex items-center justify-between w-full px-4 py-2 text-sm hover:bg-sidebar-accent transition-colors group',
                    selectedSearchMethodIds.includes(method.id) &&
                      'bg-sidebar-accent text-sidebar-accent-foreground'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate max-w-[120px]">
                      {method.name}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {method.count}
                    </span>
                    {can('uploadFiles', userRole) && onDeleteSearchMethod && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmSearchMethod(method);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4  text-muted-foreground hover:text-destructive" />
                      </div>
                    )}
                  </div>
                </button>
              ))}

              {can('uploadFiles', userRole) && (
                <div className="px-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-primary border-primary hover:bg-primary/10 bg-transparent"
                    onClick={onAddReferences}
                  >
                    Add References
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Possible Duplicates Section */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-sidebar-accent transition-colors group">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Possible Duplicates</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pb-3">
              {duplicateStatuses.map((status) => {
                const Icon = status.icon;
                const count =
                  duplicateStatusCounts[
                    status.key as keyof DuplicateStatusCounts
                  ];
                return (
                  <button
                    key={status.key}
                    onClick={() => onDuplicateStatusToggle(status.key)}
                    className={cn(
                      'flex items-center justify-between w-full px-4 py-2 text-sm hover:bg-sidebar-accent transition-colors',
                      selectedDuplicateStatuses.includes(status.key) &&
                        'bg-sidebar-accent text-sidebar-accent-foreground'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {status.label}
                    </span>
                    <span className="text-muted-foreground">{count}</span>
                  </button>
                );
              })}
              {can('manageDuplicates', userRole) && (
                <div className="px-3 pt-2 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-primary border-primary hover:bg-primary/10 bg-transparent"
                    onClick={onDetectDuplicates}
                  >
                    Detect Duplicates
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-primary border-primary hover:bg-primary/10 bg-transparent"
                    onClick={onResolveDuplicates}
                  >
                    Resolve Duplicates
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      {/* Delete Confirmation Dialogs */}
      <AlertDialog
        open={deleteConfirmSearchMethod !== null}
        onOpenChange={(open) => !open && setDeleteConfirmSearchMethod(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Search Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the search method "
              {deleteConfirmSearchMethod?.name}"? This will also delete all
              associated references and their metadata. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmSearchMethod && onDeleteSearchMethod) {
                  onDeleteSearchMethod(deleteConfirmSearchMethod);
                  setDeleteConfirmSearchMethod(null);
                }
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
