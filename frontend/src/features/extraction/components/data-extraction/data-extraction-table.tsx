import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Upload,
  Download,
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
import { AddQuestionPopover } from '@/features/extraction/components/data-extraction/add-question-popover';
import type {
  ExtractionQuestion,
  ExtractionStatus,
  ReferenceWithAnswers,
} from '@/features/extraction/types/extraction';
import {
  useSaveExtractionAnswer,
  useDownloadCSVFile,
} from '@/features/extraction/hooks/use-extraction-table';
import { EditQuestionPopover } from '@/features/extraction/components/data-extraction/edit-question-popover';
import { useQueryClient } from '@tanstack/react-query';
import { AddDataDialog } from '@/components/blocks/add-data-dialog';
import { DataExtractionSkeleton } from '@/features/extraction/components/data-extraction/data-extraction-skeleton';
import { AssigneeBadge } from '@/features/references/components/references/assignee-badge';
import { LabelBadge } from '@/features/references/components/labels/label-badge';

interface DataExtractionTableProps {
  reviewId: number;
  questions: ExtractionQuestion[];
  references: ReferenceWithAnswers[];
  selectedReferenceIds: number[];
  highlightedReferenceId: number | null;
  allSelected: boolean;
  onSelectAll: () => void;
  onSelectReference: (id: number) => void;
  onHighlightReference: (id: number | null) => void;
  onOpenDetail: (id: number) => void;
  onOpenPDF: (referenceId: number) => void;
  onAttachPDF: (referenceId: number) => void;
  isLoading?: boolean;
}

const statusColors: Record<ExtractionStatus, string> = {
  'in-progress': 'bg-amber-500',
  completed: 'bg-green-500',
};

const statusLabels: Record<ExtractionStatus, string> = {
  'in-progress': 'In Progress',
  completed: 'Completed',
};

// Cell editor component for different question types
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

  const handleSave = () => {
    if (question.type === 'date' && date) {
      onSave(format(date, 'yyyy-MM-dd'));
    } else {
      onSave(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  // Single Select
  if (question.type === 'single-select' && question.options) {
    return (
      <Select
        value={editValue || '__clear__'}
        onValueChange={(val) => {
          const newValue = val === '__clear__' ? '' : val;
          setEditValue(newValue);
          onSave(newValue);
        }}
        open
        onOpenChange={(open) => !open && onCancel()}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__clear__">
            <span className="text-muted-foreground italic">Clear</span>
          </SelectItem>
          {question.options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Multi Select
  if (question.type === 'multi-select' && question.options) {
    const selectedOptions = editValue
      ? editValue.split(',').map((s) => s.trim())
      : [];

    return (
      <div className="space-y-1">
        <Select
          value="__placeholder__"
          onValueChange={(val) => {
            if (val === '__clear__') {
              setEditValue('');
              onSave('');
              return;
            }
            const newOptions = selectedOptions.includes(val)
              ? selectedOptions.filter((o) => o !== val)
              : [...selectedOptions, val];
            const newValue = newOptions.join(', ');
            setEditValue(newValue);
            onSave(newValue);
          }}
          open
          onOpenChange={(open) => !open && onCancel()}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue
              placeholder={
                selectedOptions.length > 0
                  ? selectedOptions.join(', ')
                  : 'Select...'
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__clear__">
              <span className="text-muted-foreground italic">Clear all</span>
            </SelectItem>
            {question.options.map((option) => (
              <SelectItem key={option} value={option}>
                <div className="flex items-center gap-2">
                  <Checkbox checked={selectedOptions.includes(option)} />
                  {option}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Boolean (Yes/No)
  if (question.type === 'boolean') {
    return (
      <Select
        value={editValue || '__clear__'}
        onValueChange={(val) => {
          const newValue = val === '__clear__' ? '' : val;
          setEditValue(newValue);
          onSave(newValue);
        }}
        open
        onOpenChange={(open) => !open && onCancel()}
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

  // Number
  if (question.type === 'number') {
    return (
      <Input
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className="h-8 text-sm"
      />
    );
  }

  // Date
  if (question.type === 'date') {
    return (
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'h-8 text-sm justify-start text-left font-normal w-full',
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
            onSelect={(newDate) => {
              setDate(newDate);
              if (newDate) {
                onSave(format(newDate, 'yyyy-MM-dd'));
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

  // Free Text (default)
  return (
    <Input
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      autoFocus
      className="h-8 text-sm"
    />
  );
}

// Display component for cell values
function CellDisplay({
  question,
  value,
}: {
  question: ExtractionQuestion;
  value: string;
}) {
  if (!value) {
    return <span className="text-muted-foreground/50">Click to add</span>;
  }

  // Boolean display
  if (question.type === 'boolean') {
    return (
      <span>{value === 'true' ? 'Yes' : value === 'false' ? 'No' : value}</span>
    );
  }

  // Date display
  if (question.type === 'date') {
    try {
      const date = new Date(value);
      return <span>{format(date, 'PPP')}</span>;
    } catch {
      return <span>{value}</span>;
    }
  }

  // Multi-select display with badges
  if (question.type === 'multi-select') {
    const options = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (options.length === 0) {
      return <span className="text-muted-foreground/50">Click to add</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {options.map((option, i) => (
          <span
            key={i}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
          >
            {option}
          </span>
        ))}
      </div>
    );
  }

  // Default display
  return <span>{value}</span>;
}

// Helper function to generate consistent color from question ID
const getQuestionColor = (questionId: number) => {
  // Simple hash function for consistent colors
  const hash = questionId * 2654435761;
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

export function DataExtractionTable({
  reviewId,
  questions,
  references,
  selectedReferenceIds,
  highlightedReferenceId,
  allSelected,
  onSelectAll,
  onSelectReference,
  onHighlightReference,
  onOpenDetail,
  onOpenPDF,
  onAttachPDF,
  isLoading = false,
}: DataExtractionTableProps) {
  const [statusFilter, setStatusFilter] = useState<ExtractionStatus | 'all'>(
    'in-progress'
  );
  const [editingCell, setEditingCell] = useState<{
    referenceId: number;
    questionId: number;
  } | null>(null);
  const [isAddDataDialogOpen, setIsAddDataDialogOpen] =
    useState<boolean>(false);
  const queryClient = useQueryClient();

  // Fetch table data (single API call)
  const saveAnswerMutation = useSaveExtractionAnswer();
  const exportCSVMutation = useDownloadCSVFile();

  const totalCount = references.length;

  // Filter references by status
  const filteredReferences = useMemo(() => {
    if (statusFilter === 'all') {
      return references;
    } else if (statusFilter === 'in-progress') {
      return references.filter((ref) => !ref.isExtractionCompleted);
    } else {
      return references.filter((ref) => ref.isExtractionCompleted);
    }
  }, [references, statusFilter]);

  // Find first incomplete reference for "Extract data" button
  const firstIncompleteReference = useMemo(() => {
    return references.find((ref) => !ref.isExtractionCompleted && ref.file);
  }, [references]);

  const handleExtractData = () => {
    if (firstIncompleteReference) {
      onOpenPDF(firstIncompleteReference.id);
    }
  };

  const handleExportCSV = () => {
    exportCSVMutation.mutate(reviewId);
  };

  const handleCellClick = (referenceId: number, questionId: number) => {
    setEditingCell({ referenceId, questionId });
  };

  const handleCellSave = async (value: string) => {
    if (!editingCell) return;

    saveAnswerMutation.mutate({
      reference: editingCell.referenceId,
      question: editingCell.questionId,
      value: value,
    });

    setEditingCell(null);
  };

  const handleCellCancel = () => {
    setEditingCell(null);
  };

  const statusCounts = useMemo(() => {
    return {
      'in-progress': references.filter((r) => !r.isExtractionCompleted).length,
      completed: references.filter((r) => r.isExtractionCompleted).length,
    };
  }, [references]);

  // Row click handlers
  const handleRowClick = (id: number, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-checkbox-area]') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('[role="combobox"]') ||
      target.closest('[data-radix-popper-content-wrapper]')
    ) {
      return;
    }
    onHighlightReference(highlightedReferenceId === id ? null : id);
  };

  const handleRowDoubleClick = (id: number, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-checkbox-area]') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('[role="combobox"]') ||
      target.closest('[data-radix-popper-content-wrapper]')
    ) {
      return;
    }
    onOpenDetail(id);
  };

  const invalidateQuery = () => {
    queryClient.invalidateQueries({
      queryKey: ['extraction-table', reviewId],
    });
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <span className="text-sm sm:text-base font-medium">
            Showing {filteredReferences.length} / {totalCount}{' '}
            <span className="capitalize">
              {statusFilter === 'all' ? 'All' : statusLabels[statusFilter]}
            </span>{' '}
            Articles
          </span>
        </div>

        {/* Progress bar */}
        <div className="hidden sm:flex flex-1 max-w-md mx-6">
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${(statusCounts.completed / totalCount) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent hidden sm:flex"
            onClick={() => setIsAddDataDialogOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Add articles
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent hidden sm:flex"
            onClick={handleExportCSV}
            disabled={exportCSVMutation.isPending}
          >
            <Download className="h-4 w-4" />
            {exportCSVMutation.isPending ? 'Exporting...' : 'Export'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent hidden sm:flex"
            onClick={handleExtractData}
            disabled={!firstIncompleteReference}
          >
            <FileText className="h-4 w-4" />
            Extract data
          </Button>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-border bg-muted/30">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-foreground font-medium"
            >
              <span className="capitalize">
                {statusFilter === 'all' ? 'All' : statusLabels[statusFilter]}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => setStatusFilter('all')}
              className={cn(statusFilter === 'all' && 'bg-accent')}
            >
              <div className="w-2 h-2 rounded-full mr-2 bg-primary" />
              All ({totalCount})
            </DropdownMenuItem>
            {(Object.entries(statusLabels) as [ExtractionStatus, string][]).map(
              ([status, label]) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(statusFilter === status && 'bg-accent')}
                >
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full mr-2',
                      statusColors[status]
                    )}
                  />
                  {label} ({statusCounts[status]})
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table - see next message for table content */}
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
                Completed?
              </th>
              <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3 w-28">
                PDF
              </th>
              {questions.map((q) => {
                return (
                  <th
                    key={q.id}
                    className="text-left text-sm font-medium text-muted-foreground min-w-[120px] border-l border-border p-0"
                  >
                    <EditQuestionPopover
                      reviewId={reviewId}
                      onQuestionDeleted={invalidateQuery}
                      onQuestionUpdated={invalidateQuery}
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
                );
              })}
              <th className="px-4 py-3 w-12 border-l border-border">
                <AddQuestionPopover
                  reviewId={reviewId}
                  trigger={
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  }
                  onQuestionAdded={invalidateQuery}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <DataExtractionSkeleton questionCount={questions.length} />
            ) : (
              <>
                {filteredReferences.map((ref, index) => {
                  return (
                    <tr
                      key={ref.id}
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
                        <p className="text-sm text-foreground line-clamp-2 w-full">
                          {ref.title}
                        </p>
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
                            <ExternalLink />
                            View
                          </Button>
                        ) : (
                          <Button
                            className="flex gap-2 w-full"
                            variant="outline"
                            size="sm"
                            onClick={() => onAttachPDF(ref.id)}
                          >
                            <Paperclip />
                            Attach
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
                              !isEditing && handleCellClick(ref.id, q.id)
                            }
                          >
                            {isEditing ? (
                              <CellEditor
                                question={q}
                                value={answer?.value || ''}
                                onSave={handleCellSave}
                                onCancel={handleCellCancel}
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
                  );
                })}

                {/* Empty rows */}
                {filteredReferences.length < 14 &&
                  Array.from({ length: 14 - filteredReferences.length }).map(
                    (_, i) => (
                      <tr
                        key={`empty-${i}`}
                        className="border-b border-border h-14"
                      >
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-sm text-muted-foreground/50">
                          {filteredReferences.length + i + 1}
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
                    )
                  )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Data Dialog */}
      <AddDataDialog
        reviewId={reviewId}
        dataSources={['full-text', 'screening']}
        dataSink="extraction"
        open={isAddDataDialogOpen}
        onOpenChange={setIsAddDataDialogOpen}
        onAdd={invalidateQuery}
      />
    </div>
  );
}
