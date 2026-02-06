'use client';

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Upload,
  Download,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';
import type { Label } from '@/types/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { AddQuestionPopover } from '@/components/review-data-extraction/add-question-popover';
import type {
  ExtractionQuestion,
  ExtractionStatus,
  ReferenceWithAnswers,
} from '@/types/extraction';
import {
  useSaveExtractionAnswer,
  useDownloadCSVFile,
} from '@/hooks/use-extraction-table';
import { AssigneeBadge, LabelBadge } from '../shared/references-table-row';
import { EditQuestionPopover } from './edit-question-popover';
import { useQueryClient } from '@tanstack/react-query';

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
}

const statusColors: Record<ExtractionStatus, string> = {
  'in-progress': 'bg-amber-500',
  completed: 'bg-green-500',
};

const statusLabels: Record<ExtractionStatus, string> = {
  'in-progress': 'In Progress',
  completed: 'Completed',
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
}: DataExtractionTableProps) {
  const [statusFilter, setStatusFilter] = useState<ExtractionStatus | 'all'>(
    'in-progress'
  );
  const [editingCell, setEditingCell] = useState<{
    referenceId: number;
    questionId: number;
  } | null>(null);
  const [editValue, setEditValue] = useState('');

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
    const answer = references.find((r) => r.id === referenceId)?.answers[
      questionId
    ];
    setEditingCell({ referenceId, questionId });
    setEditValue(answer?.value || '');
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;

    saveAnswerMutation.mutate({
      reference: editingCell.referenceId,
      question: editingCell.questionId,
      value: editValue,
    });

    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCellBlur();
    }
    if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
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
      target.closest('input')
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
      target.closest('input')
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
            onClick={() => {}}
          >
            <Upload className="h-4 w-4" />
            Add articles
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent hidden sm:flex"
            onClick={handleExtractData}
            disabled={!firstIncompleteReference}
          >
            <Sparkles className="h-4 w-4" />
            Extract data
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

      {/* Table */}
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
                            className={cn(
                              'w-2 h-2 rounded-full shrink-0',
                              q.section === 1
                                ? 'bg-amber-500'
                                : q.section === 2
                                  ? 'bg-blue-500'
                                  : 'bg-green-500'
                            )}
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

                      {ref.labels.map((label: Label) => (
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
                        variant="link"
                        size="sm"
                        className="text-primary p-0 h-auto"
                        onClick={() => onOpenPDF(ref.id)}
                      >
                        View PDF
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-primary border-primary/30 bg-primary/5 hover:bg-primary/10"
                        onClick={() => onAttachPDF(ref.id)}
                      >
                        Attach PDF
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
                        onClick={() => handleCellClick(ref.id, q.id)}
                      >
                        {isEditing ? (
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="h-8 text-sm"
                          />
                        ) : (
                          <div className="text-sm text-foreground cursor-pointer min-h-[32px] flex items-center">
                            {answer?.value || (
                              <span className="text-muted-foreground/50">
                                Click to add
                              </span>
                            )}
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
          </tbody>
        </table>
      </div>

      {/* PDF Extraction Dialog */}
      {/* {openPdfReference && (
        <PdfExtractionDialog
          reference={openPdfReference}
          onClose={() => setOpenPdfReferenceId(null)}
          onNavigate={handleNavigatePdf}
          hasPrev={currentPdfIndex > 0}
          hasNext={currentPdfIndex < filteredReferences.length - 1}
        />
      )} */}

      {/* Add Data Dialog */}
      {/* <AddDataDialog
        open={isAddDataDialogOpen}
        onOpenChange={setIsAddDataDialogOpen}
        labels={labels}
        articleCounts={0}
        onAdd={handleAddData}
      /> */}
    </div>
  );
}
