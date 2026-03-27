import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ReviewDataFooter,
  ScreeningFooter,
  ExtractionFooter,
} from './references-table-footer';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/features/references/hooks/use-notes', () => ({
  useBulkCreateNote: vi.fn(),
}));

vi.mock('@/features/extraction/hooks/use-extraction-table', () => ({
  useBulkUpdateExtractionStatus: vi.fn(),
}));

vi.mock('@/features/references/components/labels/label-popover', () => ({
  LabelPopover: ({ trigger }: any) => (
    <div data-testid="label-popover">{trigger}</div>
  ),
}));

vi.mock('@/features/references/components/references/assignee-popover', () => ({
  AssigneePopover: ({ trigger }: any) => (
    <div data-testid="assignee-popover">{trigger}</div>
  ),
}));

vi.mock('@/features/references/components/reasons/reason-popover', () => ({
  ReasonPopover: ({ trigger }: any) => (
    <div data-testid="reason-popover">{trigger}</div>
  ),
}));

import { useBulkCreateNote } from '@/features/references/hooks/use-notes';
import { useBulkUpdateExtractionStatus } from '@/features/extraction/hooks/use-extraction-table';

const mockUseBulkCreateNote = vi.mocked(useBulkCreateNote);
const mockUseBulkUpdateExtractionStatus = vi.mocked(
  useBulkUpdateExtractionStatus
);

const noopMutation = { mutate: vi.fn(), isPending: false };

const baseProps = {
  reviewId: 1,
  userRole: 'owner' as const,
  selectedReferenceIds: [],
  highlightedReferenceId: null,
};

// ── ReviewDataFooter ──────────────────────────────────────────────────────────

describe('Components - ReviewDataFooter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBulkCreateNote.mockReturnValue(noopMutation as any);
  });

  it('should render selection count when references are selected', () => {
    render(
      <ReviewDataFooter {...baseProps} selectedReferenceIds={[1, 2, 3]} />
    );
    expect(screen.getByText('3 items selected')).toBeInTheDocument();
  });

  it('should show "No items selected" when selection is empty', () => {
    render(<ReviewDataFooter {...baseProps} />);
    expect(screen.getByText('No items selected')).toBeInTheDocument();
  });

  it('should render the note input', () => {
    render(<ReviewDataFooter {...baseProps} />);
    expect(screen.getByPlaceholderText('Add note')).toBeInTheDocument();
  });

  it('should call bulkCreateNote.mutate when note is submitted via Enter', async () => {
    const mutate = vi.fn();
    mockUseBulkCreateNote.mockReturnValue({ ...noopMutation, mutate } as any);

    render(<ReviewDataFooter {...baseProps} selectedReferenceIds={[10]} />);
    const input = screen.getByPlaceholderText('Add note');
    await userEvent.type(input, 'Important note{Enter}');
    expect(mutate).toHaveBeenCalledWith({
      referenceIds: [10],
      content: 'Important note',
    });
  });

  it('should collapse the footer when the toggle bar is clicked', async () => {
    render(<ReviewDataFooter {...baseProps} selectedReferenceIds={[1]} />);
    expect(screen.getByPlaceholderText('Add note')).toBeInTheDocument();
    await userEvent.click(screen.getByText('1 item selected'));
    expect(screen.queryByPlaceholderText('Add note')).not.toBeInTheDocument();
  });

  it('should not render for viewer role (no modifyOpinion permission)', () => {
    const { container } = render(
      <ReviewDataFooter {...baseProps} userRole="viewer" />
    );
    expect(container.firstChild).toBeNull();
  });
});

// ── ScreeningFooter ───────────────────────────────────────────────────────────

describe('Components - ScreeningFooter', () => {
  const screeningProps = {
    ...baseProps,
    onOpinionApplied: vi.fn(),
    opinionStatus: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBulkCreateNote.mockReturnValue(noopMutation as any);
  });

  it('should render Include, Maybe, and Exclude buttons', () => {
    render(<ScreeningFooter {...screeningProps} selectedReferenceIds={[1]} />);
    expect(screen.getByText('Include')).toBeInTheDocument();
    expect(screen.getByText('Maybe')).toBeInTheDocument();
    expect(screen.getByText('Exclude')).toBeInTheDocument();
  });

  it('should call onOpinionApplied with "included" when Include is clicked', async () => {
    const onOpinionApplied = vi.fn();
    render(
      <ScreeningFooter
        {...screeningProps}
        selectedReferenceIds={[5, 6]}
        onOpinionApplied={onOpinionApplied}
      />
    );
    await userEvent.click(screen.getByText('Include'));
    expect(onOpinionApplied).toHaveBeenCalledWith([5, 6], 'included');
  });

  it('should call onOpinionApplied with "maybe" when Maybe is clicked', async () => {
    const onOpinionApplied = vi.fn();
    render(
      <ScreeningFooter
        {...screeningProps}
        selectedReferenceIds={[7]}
        onOpinionApplied={onOpinionApplied}
      />
    );
    await userEvent.click(screen.getByText('Maybe'));
    expect(onOpinionApplied).toHaveBeenCalledWith([7], 'maybe');
  });

  it('should call onOpinionApplied with "excluded" when Exclude is clicked', async () => {
    const onOpinionApplied = vi.fn();
    render(
      <ScreeningFooter
        {...screeningProps}
        selectedReferenceIds={[8]}
        onOpinionApplied={onOpinionApplied}
      />
    );
    await userEvent.click(screen.getByText('Exclude'));
    expect(onOpinionApplied).toHaveBeenCalledWith([8], 'excluded');
  });

  it('should show the Reason popover trigger', () => {
    render(<ScreeningFooter {...screeningProps} selectedReferenceIds={[1]} />);
    expect(screen.getByTestId('reason-popover')).toBeInTheDocument();
  });

  it('should use highlighted reference when nothing is selected', async () => {
    const onOpinionApplied = vi.fn();
    render(
      <ScreeningFooter
        {...screeningProps}
        selectedReferenceIds={[]}
        highlightedReferenceId={99}
        onOpinionApplied={onOpinionApplied}
      />
    );
    await userEvent.click(screen.getByText('Include'));
    expect(onOpinionApplied).toHaveBeenCalledWith([99], 'included');
  });
});

// ── ExtractionFooter ──────────────────────────────────────────────────────────

describe('Components - ExtractionFooter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBulkCreateNote.mockReturnValue(noopMutation as any);
    mockUseBulkUpdateExtractionStatus.mockReturnValue(noopMutation as any);
  });

  it('should render Mark as Completed and Mark as Incomplete buttons', () => {
    render(<ExtractionFooter {...baseProps} selectedReferenceIds={[1]} />);
    expect(screen.getByText('Mark as Completed')).toBeInTheDocument();
    expect(screen.getByText('Mark as Incomplete')).toBeInTheDocument();
  });

  it('should call mutate with isExtractionCompleted=true on Mark as Completed click', async () => {
    const mutate = vi.fn();
    mockUseBulkUpdateExtractionStatus.mockReturnValue({
      ...noopMutation,
      mutate,
    } as any);

    render(<ExtractionFooter {...baseProps} selectedReferenceIds={[1, 2]} />);
    await userEvent.click(screen.getByText('Mark as Completed'));
    expect(mutate).toHaveBeenCalledWith(
      { referenceIds: [1, 2], isExtractionCompleted: true },
      expect.any(Object)
    );
  });

  it('should call mutate with isExtractionCompleted=false on Mark as Incomplete click', async () => {
    const mutate = vi.fn();
    mockUseBulkUpdateExtractionStatus.mockReturnValue({
      ...noopMutation,
      mutate,
    } as any);

    render(<ExtractionFooter {...baseProps} selectedReferenceIds={[3]} />);
    await userEvent.click(screen.getByText('Mark as Incomplete'));
    expect(mutate).toHaveBeenCalledWith(
      { referenceIds: [3], isExtractionCompleted: false },
      expect.any(Object)
    );
  });

  it('should disable action buttons when nothing is selected', () => {
    render(<ExtractionFooter {...baseProps} />);
    expect(
      screen.getByText('Mark as Completed').closest('button')
    ).toBeDisabled();
    expect(
      screen.getByText('Mark as Incomplete').closest('button')
    ).toBeDisabled();
  });
});
