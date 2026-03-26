import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExtractionChartsDashboard } from './extraction-charts-dashboard';

vi.mock('@/features/extraction/components/charts/bar-chart-panel', () => ({
  BarChartPanel: ({ reviewId }: { reviewId: number }) => (
    <div data-testid="bar-chart-panel">BarChart:{reviewId}</div>
  ),
}));
vi.mock('@/features/extraction/components/charts/scatter-plot-panel', () => ({
  ScatterPlotPanel: ({ reviewId }: { reviewId: number }) => (
    <div data-testid="scatter-plot-panel">Scatter:{reviewId}</div>
  ),
}));
vi.mock(
  '@/features/extraction/components/charts/evidence-gap-map-panel',
  () => ({
    EvidenceGapMapPanel: ({ reviewId }: { reviewId: number }) => (
      <div data-testid="evidence-gap-map-panel">EvidenceGap:{reviewId}</div>
    ),
  })
);
vi.mock(
  '@/features/extraction/components/charts/publication-timeline-panel',
  () => ({
    PublicationTimelinePanel: ({ reviewId }: { reviewId: number }) => (
      <div data-testid="publication-timeline-panel">Timeline:{reviewId}</div>
    ),
  })
);

describe('Components - ExtractionChartsDashboard', () => {
  it('should render the Extraction Charts heading', () => {
    render(<ExtractionChartsDashboard reviewId={1} />);
    expect(screen.getByText('Extraction Charts')).toBeInTheDocument();
  });

  it('should render all four chart tab triggers', () => {
    render(<ExtractionChartsDashboard reviewId={1} />);
    expect(screen.getByText('Bar Chart')).toBeInTheDocument();
    expect(screen.getByText('Scatter / Bubble')).toBeInTheDocument();
    expect(screen.getByText('Evidence Gap Map')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
  });

  it('should show the BarChartPanel by default', () => {
    render(<ExtractionChartsDashboard reviewId={5} />);
    expect(screen.getByTestId('bar-chart-panel')).toBeInTheDocument();
    expect(screen.getByText('BarChart:5')).toBeInTheDocument();
  });

  it('should switch to the Scatter tab and show ScatterPlotPanel', async () => {
    render(<ExtractionChartsDashboard reviewId={5} />);
    await userEvent.click(screen.getByText('Scatter / Bubble'));
    expect(screen.getByTestId('scatter-plot-panel')).toBeInTheDocument();
  });

  it('should switch to the Evidence Gap Map tab', async () => {
    render(<ExtractionChartsDashboard reviewId={5} />);
    await userEvent.click(screen.getByText('Evidence Gap Map'));
    expect(screen.getByTestId('evidence-gap-map-panel')).toBeInTheDocument();
  });

  it('should switch to the Timeline tab', async () => {
    render(<ExtractionChartsDashboard reviewId={5} />);
    await userEvent.click(screen.getByText('Timeline'));
    expect(
      screen.getByTestId('publication-timeline-panel')
    ).toBeInTheDocument();
  });
});
