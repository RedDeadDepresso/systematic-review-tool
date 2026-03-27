import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScreeningCriteriaCard } from './screening-criteria-card';

vi.mock(
  '@/features/reviews/components/screening-criteria/screening-criteria-content',
  () => ({
    ScreeningCriteriaContent: ({
      reviewId,
      userRole,
    }: {
      reviewId: number;
      userRole: string;
    }) => (
      <div data-testid="criteria-content">
        content:{reviewId}:{userRole}
      </div>
    ),
  })
);

describe('Components - ScreeningCriteriaCard', () => {
  it('should render the Screening Criteria heading', () => {
    render(<ScreeningCriteriaCard reviewId={1} userRole="collaborator" />);
    expect(screen.getByText('Screening Criteria')).toBeInTheDocument();
  });

  it('should not show content before expanding', () => {
    render(<ScreeningCriteriaCard reviewId={1} userRole="collaborator" />);
    expect(screen.queryByTestId('criteria-content')).not.toBeInTheDocument();
  });

  it('should reveal content after clicking the trigger', async () => {
    render(<ScreeningCriteriaCard reviewId={3} userRole="reviewer" />);
    await userEvent.click(screen.getByText('Screening Criteria'));
    expect(screen.getByTestId('criteria-content')).toBeVisible();
  });

  it('should pass reviewId and userRole to the content component', async () => {
    render(<ScreeningCriteriaCard reviewId={42} userRole="owner" />);
    await userEvent.click(screen.getByText('Screening Criteria'));
    expect(screen.getByText('content:42:owner')).toBeInTheDocument();
  });
});
