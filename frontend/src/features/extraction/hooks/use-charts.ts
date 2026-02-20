import {
  fetchBarChartData,
  fetchEvidenceGapMapData,
  fetchPublicationTimelineData,
  fetchScatterPlotData,
} from '@/features/extraction/api/charts';
import { useQuery } from '@tanstack/react-query';

export const useFetchBarChart = (questionId: number | null) => {
  return useQuery({
    queryKey: ['charts', 'bar-chart', questionId],
    queryFn: () => fetchBarChartData(questionId!),
    enabled: !!questionId,
  });
};

export const useFetchScatterPlot = (
  questionX: number | null,
  questionY: number | null,
  reviewId?: number
) => {
  return useQuery({
    queryKey: ['charts', 'scatter-plot', questionX, questionY, reviewId],
    queryFn: () => fetchScatterPlotData(questionX!, questionY!, reviewId),
    enabled: !!questionX && !!questionY,
  });
};

export const useFetchEvidenceGapMap = (
  questionRow: number | null,
  questionCol: number | null,
  reviewId?: number
) => {
  return useQuery({
    queryKey: [
      'charts',
      'evidence-gap-map',
      questionRow,
      questionCol,
      reviewId,
    ],
    queryFn: () =>
      fetchEvidenceGapMapData(questionRow!, questionCol!, reviewId),
    enabled: !!questionRow && !!questionCol,
  });
};

export const useFetchPublicationTimeline = (reviewId: number) => {
  return useQuery({
    queryKey: ['charts', 'publication-timeline', reviewId],
    queryFn: () => fetchPublicationTimelineData(reviewId),
    enabled: !!reviewId,
  });
};
