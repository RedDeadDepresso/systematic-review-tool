import type {
  SortDirection,
  SortField,
} from '@/features/references/types/references';
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Upload,
  Download,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { can } from '@/lib/permissions';
import type { ReviewRole } from '@/features/reviews/types/reviews';
import { ScreeningBreakButton } from '@/features/reviews/components/screening-stats/screening-break-button';

export type ExportType = 'all' | 'filtered';

interface TableTopHeaderProps {
  userRole: ReviewRole;
  activeFilterCount: number;
  filteredCount: number;
  totalCount: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  isLeftCollapsed?: boolean;
  onToggleLeftCollapse?: () => void;
  isRightCollapsed?: boolean;
  onToggleRightCollapse?: () => void;
  onAddData?: () => void;
  onExport?: (exportType: ExportType) => void;
  breakButtonReviewId?: number;
}

export function TableTopHeader({
  userRole,
  activeFilterCount,
  filteredCount,
  totalCount,
  searchQuery = '',
  onSearchChange,
  isLeftCollapsed,
  onToggleLeftCollapse,
  onToggleRightCollapse,
  onSortChange,
  onAddData,
  onExport,
  breakButtonReviewId,
}: TableTopHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(searchQuery !== '');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [draftSearch, setDraftSearch] = useState(searchQuery);

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    setDraftSearch('');
    onSearchChange?.('');
  };

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  return (
    <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-2 sm:gap-3">
        {isLeftCollapsed !== undefined && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onToggleLeftCollapse}
          >
            {isLeftCollapsed ? (
              <ChevronRight className="h-4 w-4 sm:mr-1" />
            ) : (
              <ChevronLeft className="h-4 w-4 sm:mr-1" />
            )}
          </Button>
        )}
        <h1 className="text-sm sm:text-lg font-semibold">
          <span className="hidden xl:inline">Showing </span>
          {filteredCount === totalCount
            ? `${totalCount}`
            : `${filteredCount} / ${totalCount}`}{' '}
          Articles
        </h1>
        {breakButtonReviewId && (
          <ScreeningBreakButton reviewId={breakButtonReviewId} />
        )}
      </div>
      <div className="flex items-center gap-2">
        {/* Search Bar */}
        <div className="flex items-center">
          {isSearchOpen ? (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-200">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search..."
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSearchChange?.(draftSearch);
                    }
                    if (e.key === 'Escape') {
                      handleSearchClose();
                    }
                  }}
                  onBlur={() => onSearchChange?.(draftSearch)}
                  className="h-8 w-32 sm:w-64 pl-8 pr-8 text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={handleSearchClose}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
        </div>
        {onAddData && can('addData', userRole) && (
          <Button variant="outline" size="sm" onClick={onAddData}>
            <Upload className="h-4 w-4" />
            <span className="hidden xl:inline">Add articles</span>
          </Button>
        )}
        {onExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 sm:mr-1" />
                <span className="hidden xl:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuItem onSelect={() => onExport('all')}>
                All
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onExport('filtered')}>
                Filtered
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ArrowUpDown className="h-4 w-4 sm:mr-1" />
              <span className="hidden xl:inline">Sort</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSortChange('title', 'asc')}>
              <ArrowUp className="h-4 w-4 mr-2" />
              Title A-Z
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange('title', 'desc')}>
              <ArrowDown className="h-4 w-4 mr-2" />
              Title Z-A
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange('date', 'desc')}>
              <ArrowDown className="h-4 w-4 mr-2" />
              Date (Newest)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange('date', 'asc')}>
              <ArrowUp className="h-4 w-4 mr-2" />
              Date (Oldest)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange('author', 'asc')}>
              <ArrowUp className="h-4 w-4 mr-2" />
              Author A-Z
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange('author', 'desc')}>
              <ArrowDown className="h-4 w-4 mr-2" />
              Author Z-A
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          onClick={onToggleRightCollapse}
          variant="outline"
          size="sm"
          className="relative inline-flex"
        >
          <Filter className="h-4 w-4 sm:mr-1" />
          <span className="hidden xl:inline">Filters</span>

          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 text-[10px] font-bold text-primary-foreground bg-primary rounded-full">
              {activeFilterCount >= 10 ? '9+' : activeFilterCount}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
