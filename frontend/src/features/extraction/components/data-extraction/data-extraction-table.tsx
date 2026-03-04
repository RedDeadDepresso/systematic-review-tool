import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import {
  Plus,
  ChevronDown,
  CheckCircle2,
  XCircle,
  FileText,
  CalendarIcon,
  ExternalLink,
  Paperclip,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { AddQuestionPopover } from '@/features/extraction/components/data-extraction/add-question-popover';
import type {
  ExtractionQuestion,
  ReferenceWithAnswers,
} from '@/features/extraction/types/extraction';
import {
  useSaveExtractionAnswer,
  useDownloadCSVFile,
} from '@/features/extraction/hooks/use-extraction-table';
import { EditQuestionPopover } from '@/features/extraction/components/data-extraction/edit-question-popover';
import { AddDataDialog } from '@/components/blocks/add-data-dialog';
import { DataExtractionSkeleton } from '@/features/extraction/components/data-extraction/data-extraction-skeleton';
import { AssigneeBadge } from '@/features/references/components/references/assignee-badge';
import { LabelBadge } from '@/features/references/components/labels/label-badge';
import {
  TableTopHeader,
  type ExportType,
} from '@/features/references/components/references/references-table-top-header';
import type { OrderingField } from '@/features/references/api/references';
import type { ReviewRole } from '@/features/reviews/types/reviews';
import { highlightText } from '@/lib/highlight-text';

// ── Types ──────────────────────────────────────────────────────────────────────

/** null = show all, true = completed only, false = in-progress only */
export type ExtractionStatusFilter = boolean | null;

interface DataExtractionTableProps {
  reviewId: number;
  userRole: ReviewRole;
  questions: ExtractionQuestion[];
  references: ReferenceWithAnswers[];
  selectedReferenceIds: number[];
  highlightedReferenceId: number | null;
  highlightIncludeKeywords: string[];
  highlightExcludeKeywords: string[];
  allSelected: boolean;
  onSelectAll: () => void;
  onSelectReference: (id: number) => void;
  onHighlightReference: (id: number | null) => void;
  onOpenDetail: (id: number) => void;
  onOpenPDF: (referenceId: number) => void;
  onAttachPDF: (referenceId: number) => void;
  onInvalidate: () => void;
  onExport: (type: ExportType) => void;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  totalCount: number;
  filteredCount: number;
  // Filters toolbar
  activeFilterCount: number;
  ordering: OrderingField;
  onOrderingChange: (o: OrderingField) => void;
  isFiltersSidebarCollapsed: boolean;
  onToggleFiltersSidebar: () => void;
  // Extraction status — server-side filter
  extractionStatusFilter: ExtractionStatusFilter;
  onExtractionStatusFilterChange: (v: ExtractionStatusFilter) => void;
  // Counts for the dropdown labels (from filterCounts, not paginated pages)
  completedCount: number;
  inProgressCount: number;
}

// ── CellEditor ─────────────────────────────────────────────────────────────────

function CellEditor({
  question,
  value,
  onSave,
  onCancel,
}: {
  question: ExtractionQuestion;
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [editValue, setEditValue] = useState(value);
  const [date, setDate] = useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const commit = () => {
    if (question.type === 'date' && date) onSave(format(date, 'yyyy-MM-dd'));
    else onSave(editValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Escape') onCancel();
  };

  if (question.type === 'single-select' && question.options) {
    return (
      <Select
        value={editValue || '__clear__'}
        onValueChange={(v) => {
          const val = v === '__clear__' ? '' : v;
          setEditValue(val);
          onSave(val);
        }}
        open
        onOpenChange={(o) => !o && onCancel()}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__clear__">
            <span className="text-muted-foreground italic">Clear</span>
          </SelectItem>
          {question.options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (question.type === 'multi-select' && question.options) {
    const selected = editValue ? editValue.split(',').map((s) => s.trim()) : [];
    return (
      <Select
        value="__placeholder__"
        onValueChange={(v) => {
          if (v === '__clear__') {
            setEditValue('');
            onSave('');
            return;
          }
          const next = selected.includes(v)
            ? selected.filter((o) => o !== v)
            : [...selected, v];
          const val = next.join(', ');
          setEditValue(val);
          onSave(val);
        }}
        open
        onOpenChange={(o) => !o && onCancel()}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue
            placeholder={
              selected.length > 0 ? selected.join(', ') : 'Select...'
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__clear__">
            <span className="text-muted-foreground italic">Clear all</span>
          </SelectItem>
          {question.options.map((o) => (
            <SelectItem key={o} value={o}>
              <div className="flex items-center gap-2">
                <Checkbox checked={selected.includes(o)} />
                {o}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (question.type === 'boolean') {
    return (
      <Select
        value={editValue || '__clear__'}
        onValueChange={(v) => {
          const val = v === '__clear__' ? '' : v;
          setEditValue(val);
          onSave(val);
        }}
        open
        onOpenChange={(o) => !o && onCancel()}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__clear__">
            <span className="text-muted-foreground italic">Clear</span>
          </SelectItem>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (question.type === 'number') {
    return (
      <Input
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        autoFocus
        className="h-8 text-sm"
      />
    );
  }

  if (question.type === 'date') {
    return (
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'h-8 text-sm justify-start font-normal w-full',
              !date && 'text-muted-foreground'
            )}
            onClick={() => setIsCalendarOpen(true)}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'PPP') : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              setDate(d);
              if (d) {
                onSave(format(d, 'yyyy-MM-dd'));
                setIsCalendarOpen(false);
              }
            }}
            initialFocus
          />
          <div className="p-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setDate(undefined);
                onSave('');
                setIsCalendarOpen(false);
              }}
            >
              Clear
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Input
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      autoFocus
      className="h-8 text-sm"
    />
  );
}

// ── CellDisplay ────────────────────────────────────────────────────────────────

function CellDisplay({
  question,
  value,
}: {
  question: ExtractionQuestion;
  value: string;
}) {
  if (!value)
    return <span className="text-muted-foreground/50">Click to add</span>;
  if (question.type === 'boolean')
    return (
      <span>{value === 'true' ? 'Yes' : value === 'false' ? 'No' : value}</span>
    );
  if (question.type === 'date') {
    try {
      return <span>{format(new Date(value), 'PPP')}</span>;
    } catch {
      return <span>{value}</span>;
    }
  }
  if (question.type === 'multi-select') {
    const opts = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!opts.length)
      return <span className="text-muted-foreground/50">Click to add</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {opts.map((o, i) => (
          <span
            key={i}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
          >
            {o}
          </span>
        ))}
      </div>
    );
  }
  return <span>{value}</span>;
}

const getQuestionColor = (id: number) =>
  `hsl(${(id * 2654435761) % 360}, 70%, 50%)`;

// ── Component ──────────────────────────────────────────────────────────────────

export function DataExtractionTable({
  reviewId,
  userRole,
  questions,
  references,
  selectedReferenceIds,
  highlightedReferenceId,
  highlightIncludeKeywords,
  highlightExcludeKeywords,
  allSelected,
  onSelectAll,
  onSelectReference,
  onHighlightReference,
  onOpenDetail,
  onOpenPDF,
  onAttachPDF,
  onInvalidate,
  onExport,
  isLoading = false,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  totalCount,
  filteredCount,
  activeFilterCount,
  ordering,
  onOrderingChange,
  isFiltersSidebarCollapsed,
  onToggleFiltersSidebar,
  extractionStatusFilter,
  onExtractionStatusFilterChange,
  completedCount,
  inProgressCount,
}: DataExtractionTableProps) {
  const [editingCell, setEditingCell] = useState<{
    referenceId: number;
    questionId: number;
  } | null>(null);
  const [isAddDataDialogOpen, setIsAddDataDialogOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const saveAnswerMutation = useSaveExtractionAnswer();
  const exportCSVMutation = useDownloadCSVFile();

  // ── Infinite scroll ────────────────────────────────────────────────────────
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage)
        onLoadMore?.();
    },
    [hasNextPage, isFetchingNextPage, onLoadMore]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(handleIntersect, {
      rootMargin: '0px 0px 200px 0px',
      threshold: 0,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [handleIntersect]);

  const firstIncompleteReference = useMemo(
    () => references.find((r) => !r.isExtractionCompleted && r.file),
    [references]
  );

  const statusLabel =
    extractionStatusFilter === null
      ? 'All'
      : extractionStatusFilter
        ? 'Completed'
        : 'In Progress';

  const handleCellSave = (value: string) => {
    if (!editingCell) return;
    saveAnswerMutation.mutate(
      {
        reference: editingCell.referenceId,
        question: editingCell.questionId,
        value,
      },
      { onSuccess: onInvalidate }
    );
    setEditingCell(null);
  };

  const handleRowClick = (id: number, e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (
      t.closest('[data-checkbox-area]') ||
      t.closest('button') ||
      t.closest('input') ||
      t.closest('[role="combobox"]') ||
      t.closest('[data-radix-popper-content-wrapper]')
    )
      return;
    onHighlightReference(highlightedReferenceId === id ? null : id);
  };

  const handleRowDoubleClick = (id: number, e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (
      t.closest('[data-checkbox-area]') ||
      t.closest('button') ||
      t.closest('input') ||
      t.closest('[role="combobox"]') ||
      t.closest('[data-radix-popper-content-wrapper]')
    )
      return;
    onOpenDetail(id);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* ── Shared top header ───────────────────────────────────────────── */}
      <TableTopHeader
        userRole={userRole}
        activeFilterCount={activeFilterCount}
        filteredCount={filteredCount}
        totalCount={totalCount}
        ordering={ordering}
        onOrderingChange={onOrderingChange}
        isRightCollapsed={isFiltersSidebarCollapsed}
        onToggleRightCollapse={onToggleFiltersSidebar}
        onExport={onExport}
        extraExportActions={
          <DropdownMenuItem
            onSelect={() => exportCSVMutation.mutate(reviewId)}
            disabled={exportCSVMutation.isPending}
          >
            {exportCSVMutation.isPending
              ? 'Exporting Table CSV...'
              : 'Table CSV'}
          </DropdownMenuItem>
        }
        onAddData={() => setIsAddDataDialogOpen(true)}
        extraActions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                firstIncompleteReference &&
                onOpenPDF(firstIncompleteReference.id)
              }
              disabled={!firstIncompleteReference}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden xl:inline ml-1">Extract data</span>
            </Button>
          </>
        }
      />

      {/* ── Sub-header: select-all + progress + status filter ───────────── */}
      <div className="flex items-center px-3 sm:px-6 py-3 border-b border-border bg-muted/50 gap-3 text-sm font-medium text-muted-foreground">
        <div className="w-10 flex items-center">
          <Checkbox checked={allSelected} onCheckedChange={onSelectAll} />
        </div>

        {/* Status filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground font-medium h-7"
            >
              {statusLabel}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem
              onClick={() => onExtractionStatusFilterChange(null)}
              className={cn(
                extractionStatusFilter === null && 'bg-accent font-medium'
              )}
            >
              <div className="w-2 h-2 rounded-full mr-2 bg-primary" />
              All ({totalCount})
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onExtractionStatusFilterChange(false)}
              className={cn(
                extractionStatusFilter === false && 'bg-accent font-medium'
              )}
            >
              <div className="w-2 h-2 rounded-full mr-2 bg-amber-500" />
              In Progress ({inProgressCount})
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onExtractionStatusFilterChange(true)}
              className={cn(
                extractionStatusFilter === true && 'bg-accent font-medium'
              )}
            >
              <div className="w-2 h-2 rounded-full mr-2 bg-green-500" />
              Completed ({completedCount})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Progress bar */}
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-xs">
          <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width:
                  totalCount > 0
                    ? `${(completedCount / totalCount) * 100}%`
                    : '0%',
              }}
            />
          </div>
          <span className="text-xs shrink-0">
            {completedCount}/{totalCount} done
          </span>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-max">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3 w-12">
                <Checkbox checked={allSelected} onCheckedChange={onSelectAll} />
              </th>
              <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3 w-12">
                #
              </th>
              <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3 min-w-[200px]">
                Title
              </th>
              <th className="text-left text-sm font-medium text-muted-foreground py-3 w-24">
                Done?
              </th>
              <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3 w-28">
                PDF
              </th>
              {questions.map((q) => (
                <th
                  key={q.id}
                  className="text-left text-sm font-medium text-muted-foreground min-w-[120px] border-l border-border p-0"
                >
                  <EditQuestionPopover
                    reviewId={reviewId}
                    onQuestionDeleted={onInvalidate}
                    onQuestionUpdated={onInvalidate}
                    question={q}
                    trigger={
                      <button
                        type="button"
                        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: getQuestionColor(q.id) }}
                        />
                        <span className="truncate">{q.columnTitle}</span>
                        {q.required && (
                          <span className="text-destructive">*</span>
                        )}
                      </button>
                    }
                  />
                </th>
              ))}
              <th className="px-4 py-3 w-12 border-l border-border">
                <AddQuestionPopover
                  reviewId={reviewId}
                  trigger={
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  }
                  onQuestionAdded={onInvalidate}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <DataExtractionSkeleton questionCount={questions.length} />
            ) : (
              <>
                {references.map((ref, index) => (
                  <tr
                    key={ref.id}
                    data-reference-id={ref.id}
                    onClick={(e) => handleRowClick(ref.id, e)}
                    onDoubleClick={(e) => handleRowDoubleClick(ref.id, e)}
                    className={cn(
                      'border-b border-border hover:bg-muted/30 transition-colors cursor-pointer',
                      selectedReferenceIds.includes(ref.id) && 'bg-primary/5',
                      highlightedReferenceId === ref.id &&
                        'bg-primary/10 ring-1 ring-primary/30'
                    )}
                  >
                    <td className="px-4 py-3" data-checkbox-area>
                      <Checkbox
                        checked={selectedReferenceIds.includes(ref.id)}
                        onCheckedChange={() => onSelectReference(ref.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 max-w-[300px]">
                      <button
                        type="button"
                        className="text-sm text-foreground line-clamp-2 text-left hover:text-primary hover:underline transition-colors w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDetail(ref.id);
                        }}
                      >
                        {highlightText(
                          ref.title,
                          highlightIncludeKeywords,
                          highlightExcludeKeywords
                        )}
                      </button>
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {ref.assignee && (
                          <AssigneeBadge assignee={ref.assignee} />
                        )}
                        {ref.labels.map((label) => (
                          <LabelBadge key={label.id} label={label} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {ref.isExtractionCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground/50" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ref.file ? (
                        <Button
                          className="flex gap-2 w-full"
                          size="sm"
                          onClick={() => onOpenPDF(ref.id)}
                        >
                          <ExternalLink className="h-4 w-4" /> View
                        </Button>
                      ) : (
                        <Button
                          className="flex gap-2 w-full"
                          variant="outline"
                          size="sm"
                          onClick={() => onAttachPDF(ref.id)}
                        >
                          <Paperclip className="h-4 w-4" /> Attach
                        </Button>
                      )}
                    </td>
                    {questions.map((q) => {
                      const answer = ref.answers[q.id];
                      const isEditing =
                        editingCell?.referenceId === ref.id &&
                        editingCell?.questionId === q.id;
                      return (
                        <td
                          key={q.id}
                          className="px-4 py-3 border-l border-border"
                          onClick={() =>
                            !isEditing &&
                            setEditingCell({
                              referenceId: ref.id,
                              questionId: q.id,
                            })
                          }
                        >
                          {isEditing ? (
                            <CellEditor
                              question={q}
                              value={answer?.value || ''}
                              onSave={handleCellSave}
                              onCancel={() => setEditingCell(null)}
                            />
                          ) : (
                            <div className="text-sm text-foreground cursor-pointer min-h-[32px] flex items-center">
                              <CellDisplay
                                question={q}
                                value={answer?.value || ''}
                              />
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 border-l border-border" />
                  </tr>
                ))}

                {!isFetchingNextPage &&
                  references.length < 14 &&
                  Array.from({ length: 14 - references.length }).map((_, i) => (
                    <tr
                      key={`empty-${i}`}
                      className="border-b border-border h-14"
                    >
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-sm text-muted-foreground/50">
                        {references.length + i + 1}
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                      {questions.map((q) => (
                        <td
                          key={q.id}
                          className="px-4 py-3 border-l border-border"
                        />
                      ))}
                      <td className="px-4 py-3 border-l border-border" />
                    </tr>
                  ))}
              </>
            )}
          </tbody>
        </table>

        {/* Sentinel */}
        <div
          ref={sentinelRef}
          className="py-4 flex items-center justify-center"
        >
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading more…
            </div>
          )}
          {!hasNextPage && references.length > 0 && !isLoading && (
            <p className="text-xs text-muted-foreground">
              All {references.length} references loaded
            </p>
          )}
        </div>
      </div>

      <AddDataDialog
        reviewId={reviewId}
        dataSources={['full-text', 'screening']}
        dataSink="extraction"
        open={isAddDataDialogOpen}
        onOpenChange={setIsAddDataDialogOpen}
        onAdd={onInvalidate}
      />
    </div>
  );
}
