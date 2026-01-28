import React, { useState } from 'react';

import {
  ArrowUp,
  ArrowDown,
  Paperclip,
  Tag,
  Send,
  ChevronDown,
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
import type { Reference, Label, ArticleViewLayout } from '@/types/reference';
import { LabelPopover } from '@/components/shared/label-popover';
import { highlightText } from '@/lib/reference';

type SortField = 'title' | 'date' | 'author';
type SortDirection = 'asc' | 'desc';

interface ReferencesTableProps {
  references: Reference[];
  selectedReferenceIds: number[];
  highlightedReferenceId: number | null;
  onSelectReference: (id: number) => void;
  onHighlightReference: (id: number | null) => void;
  onSelectAll: () => void;
  highlightIncludeKeywords?: string[];
  highlightExcludeKeywords?: string[];
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  onOpenDetail: (id: number) => void;
  onLabelsApplied?: () => void;
  onAttachPDF?: () => void;
  viewLayout?: ArticleViewLayout;
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

const renderOpinionBadge = (
  opinion: { reviewer: string; status: string },
  idx: number
) => (
  <Badge
    key={idx}
    className={cn(
      'flex items-center gap-1 text-xs',
      opinion.status === 'Included' &&
        'bg-green-50 text-green-700 border-green-200',
      opinion.status === 'Maybe' &&
        'bg-yellow-50 text-yellow-700 border-yellow-200',
      opinion.status === 'Excluded' && 'bg-red-50 text-red-700 border-red-200',
      opinion.status === 'Undecided' &&
        'bg-gray-50 text-gray-600 border-gray-200'
    )}
  >
    {opinion.status === 'Included' && '✓'}
    {opinion.status === 'Maybe' && '?'}
    {opinion.status === 'Excluded' && '✕'}
    <span>{opinion.reviewer}</span>
  </Badge>
);

export function ReferencesTable({
  references,
  selectedReferenceIds,
  highlightedReferenceId,
  onSelectReference,
  onHighlightReference,
  onSelectAll,
  highlightIncludeKeywords = [],
  highlightExcludeKeywords = [],
  sortField,
  sortDirection,
  onSortChange,
  onOpenDetail,
  onLabelsApplied,
  onAttachPDF,
  viewLayout,
}: ReferencesTableProps) {
  const [noteText, setNoteText] = useState('');
  const allSelected =
    references.length > 0 && selectedReferenceIds.length === references.length;
  const hasHighlightedRow = highlightedReferenceId !== null;

  const handleRowClick = (id: number, e: React.MouseEvent) => {
    // If clicking checkbox area, don't highlight
    const target = e.target as HTMLElement;
    if (target.closest('[data-checkbox-area]')) {
      return;
    }
    // Toggle highlight
    onHighlightReference(highlightedReferenceId === id ? null : id);
  };

  const handleRowDoubleClick = (id: number, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-checkbox-area]')) {
      return;
    }
    onOpenDetail(id);
  };

  // Get reference IDs for label popover
  const selectedRefsForLabels =
    selectedReferenceIds.length > 0
      ? selectedReferenceIds
      : highlightedReferenceId !== null
        ? [highlightedReferenceId]
        : [];

  return (
    <div
      className={cn(
        'flex flex-col min-w-0',
        viewLayout === 'title-abstract' ? 'w-80' : 'flex-1'
      )}
    >
      {/* Table Header */}
      <div className="flex items-center px-3 sm:px-6 py-3 border-b border-border bg-muted/50 text-sm font-medium text-muted-foreground">
        <div className="flex items-center gap-3 w-10">
          <Checkbox checked={allSelected} onCheckedChange={onSelectAll} />
        </div>
        {viewLayout === 'title-abstract' && <span>All references</span>}
        {viewLayout === 'title-only' && (
          <>
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
          </>
        )}
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto">
        {viewLayout === 'title-abstract'
          ? /* ===== TITLE + ABSTRACT STYLE ===== */
            references.map((ref, index) => (
              <div
                key={ref.id}
                onClick={(e) => handleRowClick(ref.id, e)}
                onDoubleClick={(e) => handleRowDoubleClick(ref.id, e)}
                className={cn(
                  'cursor-pointer border-b border-border p-4 transition-colors',
                  selectedReferenceIds.includes(ref.id) && 'bg-muted',
                  highlightedReferenceId === ref.id &&
                    'bg-primary/10 ring-1 ring-primary/30',
                  !selectedReferenceIds.includes(ref.id) &&
                    highlightedReferenceId !== ref.id &&
                    'hover:bg-accent'
                )}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={selectedReferenceIds.includes(ref.id)}
                    onCheckedChange={() => onSelectReference(ref.id)}
                  />

                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-muted-foreground w-5">
                        {index + 1}
                      </span>

                      <div className="flex-1 min-w-0">
                        {/* Title */}
                        <p className="text-sm font-medium leading-snug">
                          {highlightText(
                            ref.title,
                            highlightIncludeKeywords,
                            highlightExcludeKeywords
                          )}
                        </p>

                        {/* Authors + Date */}
                        <p className="text-xs text-muted-foreground">
                          {ref.publicationDate || 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {ref.authors}
                        </p>

                        {/* Opinions */}
                        {ref.opinions?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {ref.opinions.map(renderOpinionBadge)}
                          </div>
                        )}

                        {/* Labels + PDF */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {ref.file && (
                            <Badge variant="secondary" className="text-xs">
                              PDF
                            </Badge>
                          )}

                          {ref.labels.map((label: Label) => (
                            <Badge
                              key={label.id}
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
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          : /* ===== TITLE-ONLY STYLE ===== */
            references.map((ref, index) => (
              <div
                key={ref.id}
                onClick={(e) => handleRowClick(ref.id, e)}
                onDoubleClick={(e) => handleRowDoubleClick(ref.id, e)}
                className={cn(
                  'flex items-start px-3 sm:px-6 py-3 sm:py-4 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer',
                  selectedReferenceIds.includes(ref.id) && 'bg-primary/5',
                  highlightedReferenceId === ref.id &&
                    'bg-primary/10 ring-1 ring-primary/30'
                )}
              >
                <div className="flex items-center gap-3 w-10 pt-1">
                  <Checkbox
                    checked={selectedReferenceIds.includes(ref.id)}
                    onCheckedChange={() => onSelectReference(ref.id)}
                  />
                </div>

                <div className="flex items-start gap-3 w-6 sm:w-10 pt-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {index + 1}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm leading-relaxed">
                    {highlightText(
                      ref.title,
                      highlightIncludeKeywords,
                      highlightExcludeKeywords
                    )}
                  </p>

                  {/* Opinions */}
                  {ref.opinions?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {ref.opinions.map(renderOpinionBadge)}
                    </div>
                  )}

                  {/* Labels + PDF */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {ref.file && (
                      <Badge variant="secondary" className="text-xs">
                        PDF
                      </Badge>
                    )}

                    {ref.labels.map((label: Label) => (
                      <Badge
                        key={label.id}
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
                    ))}
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
      {viewLayout === 'title-only' && (
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
      )}
    </div>
  );
}
