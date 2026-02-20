import api from '../../../api/client';

export const fetchBarChartData = async (
  questionId: number
): Promise<BarChartData> => {
  const res = await api.get(`/charts/bar-chart/`, {
    params: { questionId },
  });
  return res.data;
};

export const fetchScatterPlotData = async (
  questionX: number,
  questionY: number,
  reviewId?: number
): Promise<ScatterPlotData> => {
  const res = await api.get(`/charts/scatter-plot/`, {
    params: { questionX, questionY, ...(reviewId && { reviewId }) },
  });
  return res.data;
};

export const fetchEvidenceGapMapData = async (
  questionRow: number,
  questionCol: number,
  reviewId?: number
): Promise<EvidenceGapMapData> => {
  const res = await api.get(`/charts/evidence-gap-map/`, {
    params: { questionRow, questionCol, ...(reviewId && { reviewId }) },
  });
  return res.data;
};

export const fetchPublicationTimelineData = async (
  reviewId: number
): Promise<PublicationTimelineData> => {
  const res = await api.get(`/charts/publication-timeline/`, {
    params: { reviewId },
  });
  return res.data;
};
