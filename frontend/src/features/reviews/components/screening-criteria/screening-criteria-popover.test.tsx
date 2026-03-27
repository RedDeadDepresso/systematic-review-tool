import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScreeningCriteriaPopover } from './screening-criteria-popover';

vi.mock(
  '@/features/reviews/components/screening-criteria/screening-criteria-content',
  () => ({
    ScreeningCriteriaContent: ({ reviewId, userRole, onClose }: any) => (
      <div data-testid="criteria-content">
        <span>
          content:{reviewId}:{userRole}
        </span>
        {onClose && <button onClick={onClose}>Close</button>}
      </div>
    ),
  })
);

describe('Components - ScreeningCriteriaPopover', () => {
  it('should render the trigger', () => {
    render(
      <ScreeningCriteriaPopover
        trigger={<button>Criteria</button>}
        reviewId={1}
        userRole="collaborator"
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByText('Criteria')).toBeInTheDocument();
  });

  it('should show ScreeningCriteriaContent when open is true', () => {
    render(
      <ScreeningCriteriaPopover
        trigger={<button>Criteria</button>}
        reviewId={3}
        userRole="reviewer"
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('criteria-content')).toBeInTheDocument();
    expect(screen.getByText('content:3:reviewer')).toBeInTheDocument();
  });

  it('should not show criteria content when open is false', () => {
    render(
      <ScreeningCriteriaPopover
        trigger={<button>Criteria</button>}
        reviewId={1}
        userRole="collaborator"
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.queryByTestId('criteria-content')).not.toBeInTheDocument();
  });

  it('should call onOpenChange(true) when trigger is clicked', async () => {
    const onOpenChange = vi.fn();
    render(
      <ScreeningCriteriaPopover
        trigger={<button>Criteria</button>}
        reviewId={1}
        userRole="collaborator"
        open={false}
        onOpenChange={onOpenChange}
      />
    );
    await userEvent.click(screen.getByText('Criteria'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('should call onOpenChange(false) when the popover Close button is clicked', async () => {
    const onOpenChange = vi.fn();
    render(
      <ScreeningCriteriaPopover
        trigger={<button>Criteria</button>}
        reviewId={1}
        userRole="collaborator"
        open={true}
        onOpenChange={onOpenChange}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should toggle open state via the "c" keyboard shortcut', async () => {
    const onOpenChange = vi.fn();
    render(
      <ScreeningCriteriaPopover
        trigger={<button>Criteria</button>}
        reviewId={1}
        userRole="collaborator"
        open={false}
        onOpenChange={onOpenChange}
      />
    );
    await userEvent.keyboard('c');
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
