import React, { useEffect, useRef, useState } from 'react';

import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Paperclip,
  Tag,
  Send,
  ChevronDown,
  Search,
  X,
  Filter,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Reference, Label } from '@/types/reference';
import { LabelPopover } from '@/components/shared/label-popover';

type SortField = 'title' | 'date' | 'author';
type SortDirection = 'asc' | 'desc';

interface ReferencesTableProps {
  references: Reference[];
  filteredCount: number;
  totalCount: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  selectedReferences: number[];
  highlightedReference: number | null;
  onSelectReference: (id: number) => void;
  onHighlightReference: (id: number | null) => void;
  onSelectAll: () => void;
  highlightIncludeKeywords?: string[];
  highlightExcludeKeywords?: string[];
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  onOpenDetail: (id: number) => void;
  labels: Label[];
  onLabelsApplied?: () => void;
  isLeftCollapsed?: boolean;
  onToggleLeftCollapse?: () => void;
  isRightCollapsed?: boolean;
  onToggleRightCollapse?: () => void;
  onAttachPDF?: () => void;
}

function highlightText(
  text: string,
  includeKeywords: string[],
  excludeKeywords: string[]
): React.ReactNode {
  const allKeywords = [...includeKeywords, ...excludeKeywords];
  if (allKeywords.length === 0) return text;

  const pattern = new RegExp(
    `(${allKeywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    const isInclude = includeKeywords.some(
      (kw) => part.toLowerCase() === kw.toLowerCase()
    );
    const isExclude = excludeKeywords.some(
      (kw) => part.toLowerCase() === kw.toLowerCase()
    );

    if (isInclude) {
      return (
        <span
          key={index}
          className="text-green-600 dark:text-green-400 font-medium"
        >
          {part}
        </span>
      );
    }
    if (isExclude) {
      return (
        <span
          key={index}
          className="text-red-600 dark:text-red-400 font-medium"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

function SortDropdown({
  field,
  label,
  currentField,
  currentDirection,
  onSort,
}: {
  field: SortField;
  label: string;
  currentField: SortField | null;
  currentDirection: SortDirection;
  onSort: (field: SortField, direction: SortDirection) => void;
}) {
  const isActive = currentField === field;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors">
          <span>{label}</span>
          {isActive ? (
            currentDirection === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-primary" />
            ) : (
              <ArrowDown className="h-3 w-3 text-primary" />
            )
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => onSort(field, 'asc')}
          className={cn(isActive && currentDirection === 'asc' && 'bg-accent')}
        >
          <ArrowUp className="h-4 w-4 mr-2" />
          Ascending
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSort(field, 'desc')}
          className={cn(isActive && currentDirection === 'desc' && 'bg-accent')}
        >
          <ArrowDown className="h-4 w-4 mr-2" />
          Descending
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ReferencesTable({
  references,
  filteredCount,
  totalCount,
  searchQuery = '',
  onSearchChange,
  selectedReferences,
  highlightedReference,
  onSelectReference,
  onHighlightReference,
  onSelectAll,
  highlightIncludeKeywords = [],
  highlightExcludeKeywords = [],
  sortField,
  sortDirection,
  onSortChange,
  onOpenDetail,
  labels,
  onLabelsApplied,
  isLeftCollapsed,
  onToggleLeftCollapse,
  onToggleRightCollapse,
  onAttachPDF,
}: ReferencesTableProps) {
  const [noteText, setNoteText] = useState('');
  const allSelected =
    references.length > 0 && selectedReferences.length === references.length;
  const hasHighlightedRow = highlightedReference !== null;
  const [isSearchOpen, setIsSearchOpen] = useState(searchQuery !== '');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [draftSearch, setDraftSearch] = useState(searchQuery);

  useEffect(() => {
    setDraftSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    setDraftSearch('');
    onSearchChange?.('');
  };

  const handleRowClick = (id: number, e: React.MouseEvent) => {
    // If clicking checkbox area, don't highlight
    const target = e.target as HTMLElement;
    if (target.closest('[data-checkbox-area]')) {
      return;
    }
    // Toggle highlight
    onHighlightReference(highlightedReference === id ? null : id);
  };

  const handleRowDoubleClick = (id: number, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-checkbox-area]')) {
      return;
    }
    onOpenDetail(id);
  };

  const getLabelById = (labelId: number) => {
    return labels.find((l) => l.id === labelId);
  };

  // Get reference IDs for label popover
  const selectedRefsForLabels =
    selectedReferences.length > 0
      ? selectedReferences
      : highlightedReference !== null
        ? [highlightedReference]
        : [];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2 sm:gap-3">
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
          <h1 className="text-sm sm:text-lg font-semibold">
            <span className="hidden sm:inline">Showing </span>
            {filteredCount === totalCount
              ? `${totalCount}`
              : `${filteredCount} / ${totalCount}`}{' '}
            Articles
          </h1>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Sort</span>
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
          <Button variant="outline" size="sm" onClick={onToggleRightCollapse}>
            <Filter className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
        </div>
      </div>

      {/* Table Header */}
      <div className="flex items-center px-3 sm:px-6 py-3 border-b border-border text-sm font-medium text-muted-foreground">
        <div className="flex items-center gap-3 w-10">
          <Checkbox checked={allSelected} onCheckedChange={onSelectAll} />
        </div>
        <div className="w-6 sm:w-10" />
        <div className="flex-1 min-w-0">
          <SortDropdown
            field="title"
            label="Title"
            currentField={sortField}
            currentDirection={sortDirection}
            onSort={onSortChange}
          />
        </div>
        <div className="hidden sm:block w-28">
          <SortDropdown
            field="date"
            label="Date"
            currentField={sortField}
            currentDirection={sortDirection}
            onSort={onSortChange}
          />
        </div>
        <div className="hidden md:block w-32">
          <SortDropdown
            field="author"
            label="Author"
            currentField={sortField}
            currentDirection={sortDirection}
            onSort={onSortChange}
          />
        </div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto max-h-full">
        {references.map((ref, index) => (
          <div
            key={ref.id}
            onClick={(e) => handleRowClick(ref.id, e)}
            onDoubleClick={(e) => handleRowDoubleClick(ref.id, e)}
            className={cn(
              'flex items-start px-3 sm:px-6 py-3 sm:py-4 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer',
              selectedReferences.includes(ref.id) && 'bg-primary/5',
              highlightedReference === ref.id &&
                'bg-primary/10 ring-1 ring-primary/30'
            )}
          >
            <div
              data-checkbox-area
              className="flex items-center gap-3 w-10 pt-1"
            >
              <Checkbox
                checked={selectedReferences.includes(ref.id)}
                onCheckedChange={() => onSelectReference(ref.id)}
              />
            </div>
            <div className="flex items-start gap-3 w-6 sm:w-10 pt-1">
              <span className="text-xs sm:text-sm text-muted-foreground">
                {index + 1}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm leading-relaxed text-foreground">
                {highlightText(
                  ref.title,
                  highlightIncludeKeywords,
                  highlightExcludeKeywords
                )}
              </p>
              <div className="flex items-center gap-1 sm:gap-2 mt-2 flex-wrap">
                {ref.file && (
                  <Badge variant="secondary" className="text-xs">
                    PDF
                  </Badge>
                )}
                {ref.labelIds?.map((labelId) => {
                  const label = getLabelById(labelId);
                  if (!label) return null;
                  return (
                    <Badge
                      key={labelId}
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: label.color,
                        color: label.color,
                        backgroundColor: `${label.color}10`,
                      }}
                    >
                      {label.name}
                    </Badge>
                  );
                })}
                {/* Show date/author on mobile in badges */}
                <span className="sm:hidden text-xs text-muted-foreground">
                  {ref.publicationDate || 'N/A'} - {ref.authors?.split(',')[0]}
                </span>
              </div>
            </div>
            <div className="hidden sm:block w-28 text-sm text-muted-foreground whitespace-nowrap">
              {ref.publicationDate || 'N/A'}
            </div>
            <div className="hidden md:block w-32 text-sm text-muted-foreground truncate">
              {ref.authors}
            </div>
          </div>
        ))}

        {references.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            No references found matching your filters.
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 border-t border-border bg-card">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-transparent"
          onClick={onAttachPDF}
        >
          <Paperclip className="h-4 w-4" />
          <span className="hidden sm:inline">Attach PDF</span>
        </Button>
        <LabelPopover
          trigger={
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-primary border-primary bg-transparent"
            >
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Label</span>
            </Button>
          }
          selectedReferenceIds={selectedRefsForLabels}
          onLabelsApplied={onLabelsApplied}
        />
        <div className="flex items-center gap-2 w-full">
          <Input
            placeholder="Add note"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            disabled={!hasHighlightedRow}
            className={cn(
              'flex-1 min-w-0 h-8 text-sm',
              !hasHighlightedRow && 'opacity-50 cursor-not-allowed'
            )}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 shrink-0"
            disabled={!hasHighlightedRow || !noteText.trim()}
          >
            <Send
              className={cn(
                'h-4 w-4',
                hasHighlightedRow && noteText.trim()
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}
