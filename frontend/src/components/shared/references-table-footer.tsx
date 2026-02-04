import { useState } from 'react';
import {
  Paperclip,
  Tag,
  Send,
  CircleUser,
  Check,
  X,
  CircleQuestionMark,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LabelPopover } from '@/components/shared/label-popover';
import { AssigneePopover } from './assignee-popover';
import type { OpinionStatus } from '@/types/reference';
import { useBulkCreateNote } from '@/hooks/use-note';
import type { ReviewRole } from '@/types/review';
import { can } from '@/lib/permissions';

export interface ReviewDataFooterProps {
  reviewId: number;
  userRole: ReviewRole;
  selectedReferenceIds: number[];
  highlightedReferenceId: number | null;
  onAttachPDF?: () => void;
  onLabelsApplied?: () => void;
}

export function ReviewDataFooter({
  reviewId,
  userRole,
  selectedReferenceIds,
  highlightedReferenceId,
  onAttachPDF,
  onLabelsApplied,
}: ReviewDataFooterProps) {
  const [noteText, setNoteText] = useState('');
  const bulkCreateNote = useBulkCreateNote();

  const selectedRefs =
    selectedReferenceIds.length > 0
      ? selectedReferenceIds
      : highlightedReferenceId !== null
        ? [highlightedReferenceId]
        : [];

  if (!can('modifyOpinion', userRole)) return null;

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 border-t border-border bg-card">
      {can('uploadFiles', userRole) && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-transparent"
          onClick={onAttachPDF}
        >
          <Paperclip className="h-4 w-4" />
          <span className="hidden sm:inline">Attach PDF</span>
        </Button>
      )}
      <LabelPopover
        reviewId={reviewId}
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
        selectedReferenceIds={selectedRefs}
        onLabelsApplied={onLabelsApplied}
      />
      {can('assign', userRole) && (
        <AssigneePopover
          reviewId={reviewId}
          trigger={
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-primary border-primary bg-transparent"
            >
              <CircleUser className="h-4 w-4" />
              <span className="hidden sm:inline">Assign</span>
            </Button>
          }
          selectedReferenceIds={selectedRefs}
          onAssigneeApplied={onLabelsApplied}
        />
      )}
      <div className="flex items-center gap-2 w-full">
        <Input
          placeholder="Add note"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          disabled={selectedRefs.length === 0 || bulkCreateNote.isPending}
          className={cn(
            'flex-1 min-w-0 h-8 text-sm',
            selectedRefs.length === 0 && 'opacity-50 cursor-not-allowed'
          )}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 shrink-0"
          disabled={
            selectedRefs.length === 0 ||
            !noteText.trim() ||
            bulkCreateNote.isPending
          }
          onClick={() =>
            bulkCreateNote.mutate({
              referenceIds: selectedRefs,
              content: noteText,
            })
          }
        >
          <Send
            className={cn(
              'h-4 w-4',
              selectedRefs.length !== 0 && noteText.trim()
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          />
        </Button>
      </div>
    </div>
  );
}

export interface ScreeningFooterProps extends ReviewDataFooterProps {
  onOpinionApplied: (status: OpinionStatus) => void;
}

export function ScreeningFooter({
  reviewId,
  userRole,
  selectedReferenceIds,
  highlightedReferenceId,
  onAttachPDF,
  onLabelsApplied,
  onOpinionApplied,
}: ScreeningFooterProps) {
  const [noteText, setNoteText] = useState('');
  const bulkCreateNote = useBulkCreateNote();

  const selectedRefs =
    selectedReferenceIds.length > 0
      ? selectedReferenceIds
      : highlightedReferenceId !== null
        ? [highlightedReferenceId]
        : [];

  if (!can('modifyOpinion', userRole)) return null;

  return (
    <div className="flex flex-col w-full sm:gap-3 px-3 sm:px-6 py-3 border-t border-border bg-card">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 gap-2"
          onClick={() => onOpinionApplied('Included')}
        >
          <Check className="h-4 w-4" />
          <span className="hidden sm:inline">Include</span>
        </Button>

        <Button
          size="sm"
          className="flex-1 bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 gap-2"
          onClick={() => onOpinionApplied('Maybe')}
        >
          <CircleQuestionMark className="h-4 w-4" />
          <span className="hidden sm:inline">Maybe</span>
        </Button>

        <Button
          size="sm"
          className="flex-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 gap-2"
          onClick={() => onOpinionApplied('Excluded')}
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">Exclude</span>
        </Button>

        {/* <Button
          size="sm"
          className="flex-1 bg-gray-50 text-red-700 border border-red-200 hover:bg-red-100 gap-2"
          onClick={() => onOpinionApplied('Maybe')}
        >
          <MessageSquareText className="h-4 w-4" />
          <span className="hidden sm:inline">Reason</span>
        </Button> */}
        {can('uploadFiles', userRole) && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2 bg-transparent"
            onClick={onAttachPDF}
          >
            <Paperclip className="h-4 w-4" />
            <span className="hidden sm:inline">Attach PDF</span>
          </Button>
        )}
        <LabelPopover
          reviewId={reviewId}
          trigger={
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2 text-primary border-primary bg-transparent"
            >
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Label</span>
            </Button>
          }
          selectedReferenceIds={selectedRefs}
          onLabelsApplied={onLabelsApplied}
        />
        {can('assign', userRole) && (
          <AssigneePopover
            reviewId={reviewId}
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2 text-primary border-primary bg-transparent"
              >
                <CircleUser className="h-4 w-4" />
                <span className="hidden sm:inline">Assign</span>
              </Button>
            }
            selectedReferenceIds={selectedRefs}
            onAssigneeApplied={onLabelsApplied}
          />
        )}
      </div>
      <div className="flex items-center gap-2 w-full">
        <Input
          placeholder="Add note"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          disabled={selectedRefs.length === 0 || bulkCreateNote.isPending}
          className={cn(
            'flex-1 min-w-0 h-8 text-sm',
            selectedRefs.length === 0 && 'opacity-50 cursor-not-allowed'
          )}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 shrink-0"
          disabled={
            selectedRefs.length === 0 ||
            !noteText.trim() ||
            bulkCreateNote.isPending
          }
          onClick={() =>
            bulkCreateNote.mutate({
              referenceIds: selectedRefs,
              content: noteText,
            })
          }
        >
          <Send
            className={cn(
              'h-4 w-4',
              selectedRefs.length !== 0 && noteText.trim()
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          />
        </Button>
      </div>
    </div>
  );
}
