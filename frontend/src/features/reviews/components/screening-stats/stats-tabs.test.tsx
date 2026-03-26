import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatsTabs } from './stats-tabs';

vi.mock('@/features/reviews/hooks/use-screening-stats', () => ({
  useFetchScreeningStats: vi.fn(),
  useFetchScreeningOpinions: vi.fn(),
  useFetchFullTextOpinions: vi.fn(),
}));

vi.mock(
  '@/features/reviews/components/screening-stats/screening-stats-chart',
  () => ({
    ReviewScreeningStatsChart: ({ stats }: any) => (
      <div data-testid="screening-stats-chart">StatsChart:{stats.length}</div>
    ),
  })
);

vi.mock(
  '@/features/reviews/components/screening-stats/opinion-stats-chart',
  () => ({
    ReviewOpinionStatsChart: ({ stage }: any) => (
      <div data-testid="opinion-stats-chart">OpinionChart:{stage}</div>
    ),
  })
);

import {
  useFetchScreeningStats,
  useFetchScreeningOpinions,
  useFetchFullTextOpinions,
} from '@/features/reviews/hooks/use-screening-stats';

const mockUseFetchScreeningStats = vi.mocked(useFetchScreeningStats);
const mockUseFetchScreeningOpinions = vi.mocked(useFetchScreeningOpinions);
const mockUseFetchFullTextOpinions = vi.mocked(useFetchFullTextOpinions);

describe('Components - StatsTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFetchScreeningStats.mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    mockUseFetchScreeningOpinions.mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    mockUseFetchFullTextOpinions.mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
  });

  it('should render Time, Screening, and Full-Text tabs', () => {
    render(<StatsTabs reviewId={1} />);
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Screening')).toBeInTheDocument();
    expect(screen.getByText('Full-Text')).toBeInTheDocument();
  });

  it('should show the screening stats chart on the Time tab by default', () => {
    render(<StatsTabs reviewId={1} />);
    expect(screen.getByTestId('screening-stats-chart')).toBeInTheDocument();
  });

  it('should switch to Screening tab and show opinion chart', async () => {
    render(<StatsTabs reviewId={1} />);
    await userEvent.click(screen.getByText('Screening'));
    expect(screen.getByText('OpinionChart:screening')).toBeInTheDocument();
  });

  it('should switch to Full-Text tab and show full-text opinion chart', async () => {
    render(<StatsTabs reviewId={1} />);
    await userEvent.click(screen.getByText('Full-Text'));
    expect(screen.getByText('OpinionChart:full-text')).toBeInTheDocument();
  });

  it('should pass reviewId to the screening stats hook', () => {
    render(<StatsTabs reviewId={42} />);
    expect(mockUseFetchScreeningStats).toHaveBeenCalledWith(
      expect.objectContaining({ reviewId: 42 })
    );
  });

  it('should show loading skeleton when screening stats are loading', () => {
    mockUseFetchScreeningStats.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);
    render(<StatsTabs reviewId={1} />);
    // Skeleton renders divs, chart should not be present
    expect(
      screen.queryByTestId('screening-stats-chart')
    ).not.toBeInTheDocument();
  });

  it('should lazy-enable screening opinions fetch only when Screening tab is visited', async () => {
    render(<StatsTabs reviewId={1} />);
    // Before clicking Screening tab, it should be called with enabled: false
    expect(mockUseFetchScreeningOpinions).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
    await userEvent.click(screen.getByText('Screening'));
    expect(mockUseFetchScreeningOpinions).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true })
    );
  });
});
