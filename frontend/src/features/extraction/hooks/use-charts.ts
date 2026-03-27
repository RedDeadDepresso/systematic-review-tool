import {
  fetchBarChartData,
  fetchEvidenceGapMapData,
  fetchPublicationTimelineData,
  fetchScatterPlotData,
} from '@/features/extraction/api/charts';
import { useQuery } from '@tanstack/react-query';

export const chartKeys = {
  barChart: (questionId: number | null) =>
    ['charts', 'bar-chart', questionId] as const,
  scatterPlot: (
    questionX: number | null,
    questionY: number | null,
    reviewId?: number
  ) => ['charts', 'scatter-plot', questionX, questionY, reviewId] as const,
  evidenceGapMap: (
    questionRow: number | null,
    questionCol: number | null,
    reviewId?: number
  ) =>
    ['charts', 'evidence-gap-map', questionRow, questionCol, reviewId] as const,
  publicationTimeline: (reviewId: number) =>
    ['charts', 'publication-timeline', reviewId] as const,
};

export const useFetchBarChart = (questionId: number | null) =>
  useQuery({
    queryKey: chartKeys.barChart(questionId),
    queryFn: () => fetchBarChartData(questionId!),
    enabled: !!questionId,
  });

export const useFetchScatterPlot = (
  questionX: number | null,
  questionY: number | null,
  reviewId?: number
) =>
  useQuery({
    queryKey: chartKeys.scatterPlot(questionX, questionY, reviewId),
    queryFn: () => fetchScatterPlotData(questionX!, questionY!, reviewId),
    enabled: !!questionX && !!questionY,
  });

export const useFetchEvidenceGapMap = (
  questionRow: number | null,
  questionCol: number | null,
  reviewId?: number
) =>
  useQuery({
    queryKey: chartKeys.evidenceGapMap(questionRow, questionCol, reviewId),
    queryFn: () =>
      fetchEvidenceGapMapData(questionRow!, questionCol!, reviewId),
    enabled: !!questionRow && !!questionCol,
  });

export const useFetchPublicationTimeline = (reviewId: number) =>
  useQuery({
    queryKey: chartKeys.publicationTimeline(reviewId),
    queryFn: () => fetchPublicationTimelineData(reviewId),
    enabled: !!reviewId,
  });
