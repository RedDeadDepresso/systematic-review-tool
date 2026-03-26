import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LabelPopover } from './label-popover';

vi.mock('@/features/references/hooks/use-labels', () => ({
  useFetchLabels: vi.fn(),
  useCreateLabel: vi.fn(),
  useAssignLabelsToReferences: vi.fn(),
  useDeleteLabel: vi.fn(),
}));

vi.mock('@/features/references/components/labels/label-edit-dialog', () => ({
  LabelEditDialog: () => null,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import {
  useFetchLabels,
  useCreateLabel,
  useAssignLabelsToReferences,
  useDeleteLabel,
} from '@/features/references/hooks/use-labels';

const mockUseFetchLabels = vi.mocked(useFetchLabels);
const mockUseCreateLabel = vi.mocked(useCreateLabel);
const mockUseAssignLabels = vi.mocked(useAssignLabelsToReferences);
const mockUseDeleteLabel = vi.mocked(useDeleteLabel);

const mockLabels = [
  { id: 1, name: 'High Priority', color: '#ef4444', hotkey: 'H' },
  { id: 2, name: 'Follow Up', color: '#3b82f6', hotkey: 'F' },
];

const noopMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
};

describe('Components - LabelPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFetchLabels.mockReturnValue({
      data: mockLabels,
      refetch: vi.fn(),
    } as any);
    mockUseCreateLabel.mockReturnValue(noopMutation as any);
    mockUseAssignLabels.mockReturnValue(noopMutation as any);
    mockUseDeleteLabel.mockReturnValue(noopMutation as any);
  });

  it('should open and show the Labels popover heading when trigger is clicked', async () => {
    render(
      <LabelPopover
        reviewId={1}
        trigger={<button>Open Labels</button>}
        selectedReferenceIds={[10]}
      />
    );
    await userEvent.click(screen.getByText('Open Labels'));
    // The popover heading is an h3; use heading role to disambiguate
    expect(screen.getByRole('heading', { name: 'Labels' })).toBeInTheDocument();
  });

  it('should render all labels from the hook', async () => {
    render(
      <LabelPopover
        reviewId={1}
        trigger={<button>Open</button>}
        selectedReferenceIds={[10]}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByText('High Priority')).toBeInTheDocument();
    expect(screen.getByText('Follow Up')).toBeInTheDocument();
  });

  it('should disable Apply button when no references are selected', async () => {
    render(
      <LabelPopover
        reviewId={1}
        trigger={<button>Open</button>}
        selectedReferenceIds={[]}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('should disable Apply button when no labels have been toggled', async () => {
    render(
      <LabelPopover
        reviewId={1}
        trigger={<button>Open</button>}
        selectedReferenceIds={[10]}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('should enable Apply after toggling a label checkbox', async () => {
    render(
      <LabelPopover
        reviewId={1}
        trigger={<button>Open</button>}
        selectedReferenceIds={[10]}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('should filter labels by search query', async () => {
    render(
      <LabelPopover
        reviewId={1}
        trigger={<button>Open</button>}
        selectedReferenceIds={[10]}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    await userEvent.type(
      screen.getByPlaceholderText('Search or create label...'),
      'high'
    );
    expect(screen.getByText('High Priority')).toBeInTheDocument();
    expect(screen.queryByText('Follow Up')).not.toBeInTheDocument();
  });

  it('should show create option when search does not match any label', async () => {
    render(
      <LabelPopover
        reviewId={1}
        trigger={<button>Open</button>}
        selectedReferenceIds={[10]}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    await userEvent.type(
      screen.getByPlaceholderText('Search or create label...'),
      'Brand New'
    );
    expect(screen.getByText('Create "Brand New"')).toBeInTheDocument();
  });

  it('should show "No labels found" when list is empty and no search', async () => {
    mockUseFetchLabels.mockReturnValue({ data: [], refetch: vi.fn() } as any);
    render(
      <LabelPopover
        reviewId={1}
        trigger={<button>Open</button>}
        selectedReferenceIds={[10]}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByText('No labels found')).toBeInTheDocument();
  });

  it('should call assignLabelsMutation.mutate with correct payload on Apply', async () => {
    const mutate = vi.fn();
    mockUseAssignLabels.mockReturnValue({ ...noopMutation, mutate } as any);

    render(
      <LabelPopover
        reviewId={5}
        trigger={<button>Open</button>}
        selectedReferenceIds={[10, 20]}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]); // check first label → 'checked'
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        review: 5,
        referenceIds: [10, 20],
        checkedLabelIds: [1],
        indeterminateLabelIds: [],
      }),
      expect.any(Object)
    );
  });

  it('should show Applying... text on the Apply button while mutation is in flight', async () => {
    // isApplying is internal state set when mutate is called. To observe the
    // pending text we need mutate to NOT call onSuccess immediately.
    const mutate = vi.fn(); // never resolves → isApplying stays true
    mockUseAssignLabels.mockReturnValue({ ...noopMutation, mutate } as any);

    render(
      <LabelPopover
        reviewId={1}
        trigger={<button>Open</button>}
        selectedReferenceIds={[10]}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByText('Applying...')).toBeInTheDocument();
  });
});
