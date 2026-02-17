import { useState } from 'react';
import {
  Tag,
  Send,
  CircleUser,
  Check,
  X,
  CircleQuestionMark,
  XCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquareText,
  FileText,
  Upload,
  FileSymlink,
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
import { useBulkUpdateExtractionStatus } from '@/hooks/use-extraction-table';
import { ReasonPopover } from './reason-popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export interface ReviewDataFooterProps {
  reviewId: number;
  userRole: ReviewRole;
  selectedReferenceIds: number[];
  highlightedReferenceId: number | null;
  onAttachPDF?: () => void;
  onMatchPDF?: () => void;
  onLabelsApplied?: () => void;
}

export interface ScreeningFooterProps extends ReviewDataFooterProps {
  onOpinionApplied: (status: OpinionStatus, reasonId?: number | null) => void;
}

// Shared hook for getting selected references
function useSelectedRefs(
  selectedReferenceIds: number[],
  highlightedReferenceId: number | null
) {
  return selectedReferenceIds.length > 0
    ? selectedReferenceIds
    : highlightedReferenceId !== null
      ? [highlightedReferenceId]
      : [];
}

// Shared note input component
interface NoteInputProps {
  selectedRefs: number[];
  isPending: boolean;
  onSubmit: (content: string) => void;
}

function NoteInput({ selectedRefs, isPending, onSubmit }: NoteInputProps) {
  const [noteText, setNoteText] = useState('');

  const handleSubmit = () => {
    if (noteText.trim()) {
      onSubmit(noteText);
      setNoteText('');
    }
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <Input
        placeholder="Add note"
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        disabled={selectedRefs.length === 0 || isPending}
        className={cn(
          'flex-1 min-w-0 h-8 text-sm',
          selectedRefs.length === 0 && 'opacity-50 cursor-not-allowed'
        )}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 shrink-0"
        disabled={selectedRefs.length === 0 || !noteText.trim() || isPending}
        onClick={handleSubmit}
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
  );
}

// Shared action buttons component
interface ActionButtonsProps {
  reviewId: number;
  userRole: ReviewRole;
  selectedRefs: number[];
  onAttachPDF?: () => void;
  onMatchPDF?: () => void;
  onLabelsApplied?: () => void;
}

function ActionButtons({
  reviewId,
  userRole,
  selectedRefs,
  onAttachPDF,
  onMatchPDF,
  onLabelsApplied,
}: ActionButtonsProps) {
  const attachButton = can('uploadFiles', userRole) && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2 text-primary border-primary bg-transparent"
          disabled={selectedRefs.length === 0}
        >
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">PDF</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem onClick={onAttachPDF}>
          <Upload className="h-3 w-3" />
          Upload
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMatchPDF}>
          <FileSymlink className="h-3 w-3" />
          Match
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const labelButton = (
    <LabelPopover
      reviewId={reviewId}
      trigger={
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2 text-primary border-primary bg-transparent"
          disabled={selectedRefs.length === 0}
        >
          <Tag className="h-4 w-4" />
          <span className="hidden sm:inline">Label</span>
        </Button>
      }
      selectedReferenceIds={selectedRefs}
      onLabelsApplied={onLabelsApplied}
    />
  );

  const assignButton = can('assign', userRole) && (
    <AssigneePopover
      reviewId={reviewId}
      trigger={
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2 text-primary border-primary bg-transparent"
          disabled={selectedRefs.length === 0}
        >
          <CircleUser className="h-4 w-4" />
          <span className="hidden sm:inline">Assign</span>
        </Button>
      }
      selectedReferenceIds={selectedRefs}
      onAssigneeApplied={onLabelsApplied}
    />
  );

  return (
    <>
      <>
        {labelButton}
        {assignButton}
        {attachButton}
      </>
    </>
  );
}

// Base footer wrapper with collapse functionality
interface BaseFooterProps {
  userRole: ReviewRole;
  selectedCount: number;
  children: React.ReactNode;
}

function BaseFooter({ userRole, selectedCount, children }: BaseFooterProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!can('modifyOpinion', userRole)) return null;

  return (
    <div className="border-t border-border bg-card">
      {/* Collapse toggle bar */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-3 sm:px-6 py-2 hover:bg-muted/50 transition-colors"
      >
        <span className="text-sm text-muted-foreground">
          {selectedCount > 0
            ? `${selectedCount} item${selectedCount !== 1 ? 's' : ''} selected`
            : 'No items selected'}
        </span>
        {isCollapsed ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible content */}
      {!isCollapsed && (
        <div className="flex flex-col w-full sm:gap-3 px-3 sm:px-6 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

export function ReviewDataFooter({
  reviewId,
  userRole,
  selectedReferenceIds,
  highlightedReferenceId,
  onAttachPDF,
  onMatchPDF,
  onLabelsApplied,
}: ReviewDataFooterProps) {
  const selectedRefs = useSelectedRefs(
    selectedReferenceIds,
    highlightedReferenceId
  );
  const bulkCreateNote = useBulkCreateNote();

  return (
    <BaseFooter userRole={userRole} selectedCount={selectedRefs.length}>
      <div className="flex items-center gap-2 sm:gap-3">
        <ActionButtons
          reviewId={reviewId}
          userRole={userRole}
          selectedRefs={selectedRefs}
          onAttachPDF={onAttachPDF}
          onMatchPDF={onMatchPDF}
          onLabelsApplied={onLabelsApplied}
        />
      </div>
      <NoteInput
        selectedRefs={selectedRefs}
        isPending={bulkCreateNote.isPending}
        onSubmit={(content) =>
          bulkCreateNote.mutate({
            referenceIds: selectedRefs,
            content,
          })
        }
      />
    </BaseFooter>
  );
}

export function ScreeningFooter({
  reviewId,
  userRole,
  selectedReferenceIds,
  highlightedReferenceId,
  onAttachPDF,
  onMatchPDF,
  onLabelsApplied,
  onOpinionApplied,
}: ScreeningFooterProps) {
  const selectedRefs = useSelectedRefs(
    selectedReferenceIds,
    highlightedReferenceId
  );
  const bulkCreateNote = useBulkCreateNote();

  const opinionButtons = [
    {
      label: 'Include',
      icon: Check,
      status: 'Included' as OpinionStatus,
      className:
        'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100',
    },
    {
      label: 'Maybe',
      icon: CircleQuestionMark,
      status: 'Maybe' as OpinionStatus,
      className:
        'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100',
    },
    {
      label: 'Exclude',
      icon: X,
      status: 'Excluded' as OpinionStatus,
      className:
        'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
    },
  ];

  return (
    <BaseFooter userRole={userRole} selectedCount={selectedRefs.length}>
      <div className="flex items-center gap-2">
        {opinionButtons.map(({ label, icon: Icon, status, className }) => (
          <Button
            key={status}
            size="sm"
            className={cn('flex-1 gap-2', className)}
            onClick={() => onOpinionApplied(status)}
            disabled={selectedRefs.length === 0}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
        <ReasonPopover
          reviewId={reviewId}
          trigger={
            <Button
              size="sm"
              className="flex-1 bg-gray-50 text-red-700 border border-red-200 hover:bg-red-100 gap-2"
              disabled={selectedRefs.length === 0}
            >
              <MessageSquareText className="h-4 w-4" />
              <span className="hidden sm:inline">Reason</span>
            </Button>
          }
          handleReasonApplied={(reasonId) =>
            onOpinionApplied('Excluded', reasonId)
          }
        />
        <ActionButtons
          reviewId={reviewId}
          userRole={userRole}
          selectedRefs={selectedRefs}
          onAttachPDF={onAttachPDF}
          onMatchPDF={onMatchPDF}
          onLabelsApplied={onLabelsApplied}
        />
      </div>
      <NoteInput
        selectedRefs={selectedRefs}
        isPending={bulkCreateNote.isPending}
        onSubmit={(content) =>
          bulkCreateNote.mutate({
            referenceIds: selectedRefs,
            content,
          })
        }
      />
    </BaseFooter>
  );
}

export function ExtractionFooter({
  reviewId,
  userRole,
  selectedReferenceIds,
  highlightedReferenceId,
  onAttachPDF,
  onMatchPDF,
  onLabelsApplied,
}: ReviewDataFooterProps) {
  const selectedRefs = useSelectedRefs(
    selectedReferenceIds,
    highlightedReferenceId
  );
  const bulkCreateNote = useBulkCreateNote();
  const bulkUpdateStatusMutation = useBulkUpdateExtractionStatus();

  const isDisabled =
    selectedRefs.length === 0 || bulkUpdateStatusMutation.isPending;

  return (
    <BaseFooter userRole={userRole} selectedCount={selectedRefs.length}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:text-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isDisabled}
          onClick={() =>
            bulkUpdateStatusMutation.mutate({
              referenceIds: selectedReferenceIds,
              isExtractionCompleted: true,
            })
          }
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="hidden sm:inline">Mark as Completed</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2 bg-transparent border-muted-foreground/30 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isDisabled}
          onClick={() =>
            bulkUpdateStatusMutation.mutate({
              referenceIds: selectedReferenceIds,
              isExtractionCompleted: false,
            })
          }
        >
          <XCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Mark as Incomplete</span>
        </Button>
        <ActionButtons
          reviewId={reviewId}
          userRole={userRole}
          selectedRefs={selectedRefs}
          onAttachPDF={onAttachPDF}
          onMatchPDF={onMatchPDF}
          onLabelsApplied={onLabelsApplied}
        />
      </div>
      <NoteInput
        selectedRefs={selectedRefs}
        isPending={bulkCreateNote.isPending}
        onSubmit={(content) =>
          bulkCreateNote.mutate({
            referenceIds: selectedRefs,
            content,
          })
        }
      />
    </BaseFooter>
  );
}
