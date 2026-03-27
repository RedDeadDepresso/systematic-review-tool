import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReasonPopover } from './reason-popover';

vi.mock('@/features/references/hooks/use-reasons', () => ({
  useFetchReasons: vi.fn(),
  useCreateReason: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import {
  useFetchReasons,
  useCreateReason,
} from '@/features/references/hooks/use-reasons';

const mockUseFetchReasons = vi.mocked(useFetchReasons);
const mockUseCreateReason = vi.mocked(useCreateReason);

const mockReasons = [
  { id: 1, name: 'Off topic', review: 1 },
  { id: 2, name: 'Duplicate', review: 1 },
];

const defaultCreateMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
};

describe('Components - ReasonPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFetchReasons.mockReturnValue({
      data: mockReasons,
      refetch: vi.fn(),
    } as any);
    mockUseCreateReason.mockReturnValue(defaultCreateMutation as any);
  });

  it('should open the popover and show Reasons heading when trigger is clicked', async () => {
    render(
      <ReasonPopover
        reviewId={1}
        trigger={<button>Open</button>}
        handleReasonApplied={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByText('Reasons')).toBeInTheDocument();
  });

  it('should list all fetched reasons', async () => {
    render(
      <ReasonPopover
        reviewId={1}
        trigger={<button>Open</button>}
        handleReasonApplied={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByText('Off topic')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  it('should disable Apply button until a reason is selected', async () => {
    render(
      <ReasonPopover
        reviewId={1}
        trigger={<button>Open</button>}
        handleReasonApplied={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('should enable Apply and call handleReasonApplied when a reason is selected and applied', async () => {
    const handleReasonApplied = vi.fn();
    render(
      <ReasonPopover
        reviewId={1}
        trigger={<button>Open</button>}
        handleReasonApplied={handleReasonApplied}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    await userEvent.click(screen.getByLabelText('Off topic'));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(handleReasonApplied).toHaveBeenCalledWith(1);
  });

  it('should filter reasons by search query', async () => {
    render(
      <ReasonPopover
        reviewId={1}
        trigger={<button>Open</button>}
        handleReasonApplied={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    await userEvent.type(
      screen.getByPlaceholderText('Search or create reason...'),
      'off'
    );
    expect(screen.getByText('Off topic')).toBeInTheDocument();
    expect(screen.queryByText('Duplicate')).not.toBeInTheDocument();
  });

  it('should show a Create option when query does not match any reason', async () => {
    render(
      <ReasonPopover
        reviewId={1}
        trigger={<button>Open</button>}
        handleReasonApplied={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    await userEvent.type(
      screen.getByPlaceholderText('Search or create reason...'),
      'New Reason'
    );
    expect(screen.getByText('Create "New Reason"')).toBeInTheDocument();
  });

  it('should show "No reasons found" when no reasons match', async () => {
    mockUseFetchReasons.mockReturnValue({ data: [], refetch: vi.fn() } as any);
    render(
      <ReasonPopover
        reviewId={1}
        trigger={<button>Open</button>}
        handleReasonApplied={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByText('No reasons found')).toBeInTheDocument();
  });

  it('should close popover when the X button is clicked', async () => {
    render(
      <ReasonPopover
        reviewId={1}
        trigger={<button>Open</button>}
        handleReasonApplied={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByText('Reasons')).toBeInTheDocument();
    // Click the close (X) button inside the popover header
    const closeButtons = screen
      .getAllByRole('button')
      .filter(
        (btn) => btn !== screen.getByText('Open') && btn.textContent === ''
      );
    await userEvent.click(closeButtons[0]);
    expect(screen.queryByText('Reasons')).not.toBeInTheDocument();
  });
});
