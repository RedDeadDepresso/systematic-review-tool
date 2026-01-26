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
import type { DuplicateStatusCounts, SearchMethod } from '@/api/reference';

interface SourcesSidebarProps {
  searchMethods: SearchMethod[];
  selectedSearchMethods: number[];
  onSearchMethodToggle: (id: number) => void;
  onSelectAllReferences: () => void;
  duplicateStatusCounts: DuplicateStatusCounts;
  selectedDuplicateStatuses: string[];
  onDuplicateStatusToggle: (status: string) => void;
  totalReferences: number;
  isCollapsed: boolean;
  onAddReferences: () => void;
  onDetectDuplicates: () => void;
}

export function SourcesSidebar({
  searchMethods,
  selectedSearchMethods,
  onSearchMethodToggle,
  onSelectAllReferences,
  duplicateStatusCounts,
  selectedDuplicateStatuses,
  onDuplicateStatusToggle,
  totalReferences,
  isCollapsed,
  onAddReferences,
  onDetectDuplicates,
}: SourcesSidebarProps) {
  const duplicateStatuses = [
    { key: 'Unresolved', icon: Clock, label: 'Unresolved' },
    { key: 'Deleted', icon: Trash2, label: 'Deleted' },
    { key: 'Not Duplicate', icon: XCircle, label: 'Not Duplicate' },
    { key: 'Resolved', icon: CheckCircle, label: 'Resolved' },
  ];

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
                  selectedSearchMethods.length === 0 &&
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
                    selectedSearchMethods.includes(method.id) &&
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
                    <Trash2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}

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

              <div className="px-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-primary border-primary hover:bg-primary/10 bg-transparent"
                  onClick={onDetectDuplicates}
                >
                  Detect Duplicates
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </aside>
  );
}
