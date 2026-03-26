import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatsSection } from './stats-section';

vi.mock('@/features/reviews/components/screening-stats/stats-tabs', () => ({
  StatsTabs: ({ reviewId }: { reviewId: number }) => (
    <div data-testid="stats-tabs">StatsTabs:{reviewId}</div>
  ),
}));

describe('Components - StatsSection', () => {
  it('should render the Statistics heading', () => {
    render(<StatsSection reviewId={1} />);
    expect(screen.getByText('Statistics')).toBeInTheDocument();
  });

  it('should not show StatsTabs before the section is expanded', () => {
    render(<StatsSection reviewId={1} />);
    expect(screen.queryByTestId('stats-tabs')).not.toBeInTheDocument();
  });

  it('should reveal StatsTabs after clicking the trigger', async () => {
    render(<StatsSection reviewId={5} />);
    await userEvent.click(screen.getByText('Statistics'));
    expect(screen.getByTestId('stats-tabs')).toBeVisible();
  });

  it('should pass the correct reviewId to StatsTabs', async () => {
    render(<StatsSection reviewId={42} />);
    await userEvent.click(screen.getByText('Statistics'));
    expect(screen.getByText('StatsTabs:42')).toBeInTheDocument();
  });
});
