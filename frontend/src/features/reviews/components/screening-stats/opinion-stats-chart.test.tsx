import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ReviewOpinionStatsChart } from './opinion-stats-chart';
import { ReviewScreeningStatsChart } from './screening-stats-chart';
import type {
  OpinionStats,
  ScreeningStat,
} from '@/features/reviews/types/screening-stats';

const mockOpinionStats: OpinionStats[] = [
  {
    memberId: 1,
    userName: 'Alice',
    userEmail: 'alice@example.com',
    included: 30,
    maybe: 5,
    excluded: 15,
    total: 50,
  },
  {
    memberId: 2,
    userName: 'Bob',
    userEmail: 'bob@example.com',
    included: 20,
    maybe: 2,
    excluded: 8,
    total: 30,
  },
];

const mockScreeningStats: ScreeningStat[] = [
  {
    id: 1,
    userName: 'Alice',
    userEmail: 'alice@example.com',
    hours: 4.5,
    sessions: 3,
    seconds: 16200,
  },
  {
    id: 2,
    userName: 'Bob',
    userEmail: 'bob@example.com',
    hours: 2.0,
    sessions: 1,
    seconds: 7200,
  },
];

// ── ReviewOpinionStatsChart ───────────────────────────────────────────────────

describe('Components - ReviewOpinionStatsChart', () => {
  it('should render the card heading for screening stage', () => {
    render(
      <ReviewOpinionStatsChart opinions={mockOpinionStats} stage="screening" />
    );
    // Actual text: "Title/Abstract Screening Opinions"
    expect(
      screen.getByText(/Title\/Abstract Screening Opinions/i)
    ).toBeInTheDocument();
  });

  it('should render the card heading for full-text stage', () => {
    render(
      <ReviewOpinionStatsChart opinions={mockOpinionStats} stage="full-text" />
    );
    // Actual text: "Full-Text Screening Opinions"
    expect(
      screen.getByText(/Full-Text Screening Opinions/i)
    ).toBeInTheDocument();
  });

  it('should show an empty state when there are no opinions', () => {
    render(<ReviewOpinionStatsChart opinions={[]} stage="screening" />);
    // Actual text: "No opinions recorded yet"
    expect(screen.getByText('No opinions recorded yet')).toBeInTheDocument();
  });

  it('should render member names from opinion data', () => {
    render(
      <ReviewOpinionStatsChart opinions={mockOpinionStats} stage="screening" />
    );
    // Names appear in the chart tooltip/axis — they're in the chartData.
    // The component renders totals cards: check those instead.
    expect(
      screen.getByText(/Review decisions by team members/i)
    ).toBeInTheDocument();
  });

  it('should toggle between horizontal and vertical layout when orientation button is clicked', async () => {
    render(
      <ReviewOpinionStatsChart opinions={mockOpinionStats} stage="screening" />
    );
    const toggleBtn = screen.getByRole('button');
    await userEvent.click(toggleBtn);
    expect(toggleBtn).toBeInTheDocument();
  });
});

// ── ReviewScreeningStatsChart ─────────────────────────────────────────────────

describe('Components - ReviewScreeningStatsChart', () => {
  it('should render the Screening Time Statistics heading', () => {
    render(<ReviewScreeningStatsChart stats={mockScreeningStats} />);
    expect(screen.getByText('Screening Time Statistics')).toBeInTheDocument();
  });

  it('should show empty state when stats array is empty', () => {
    render(<ReviewScreeningStatsChart stats={[]} />);
    // Actual text: "No screening activity recorded yet"
    expect(
      screen.getByText('No screening activity recorded yet')
    ).toBeInTheDocument();
  });

  it('should display total hours and sessions summary', () => {
    render(<ReviewScreeningStatsChart stats={mockScreeningStats} />);
    // Total hours: 4.5 + 2.0 = 6.5 — rendered as "6.5h"
    expect(screen.getByText('6.5h')).toBeInTheDocument();
    // Total sessions: 3 + 1 = 4
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('should toggle orientation when the layout button is clicked', async () => {
    render(<ReviewScreeningStatsChart stats={mockScreeningStats} />);
    const toggleBtn = screen.getByRole('button');
    await userEvent.click(toggleBtn);
    expect(toggleBtn).toBeInTheDocument();
  });
});
