import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchBarChartData,
  fetchScatterPlotData,
  fetchEvidenceGapMapData,
  fetchPublicationTimelineData,
} from './charts';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('Extraction API - Charts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchBarChartData', () => {
    it('should fetch bar chart data', async () => {
      const mockData = { labels: [], datasets: [] };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchBarChartData(1);

      expect(api.get).toHaveBeenCalledWith('/charts/bar-chart/', {
        params: { questionId: 1 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('fetchScatterPlotData', () => {
    it('should fetch scatter plot data', async () => {
      const mockData = { datasets: [] };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchScatterPlotData(1, 2, 3);

      expect(api.get).toHaveBeenCalledWith('/charts/scatter-plot/', {
        params: { questionX: 1, questionY: 2, reviewId: 3 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('fetchEvidenceGapMapData', () => {
    it('should fetch evidence gap map data', async () => {
      const mockData = { rows: [], columns: [], values: [] };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchEvidenceGapMapData(1, 2, 3);

      expect(api.get).toHaveBeenCalledWith('/charts/evidence-gap-map/', {
        params: { questionRow: 1, questionCol: 2, reviewId: 3 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('fetchPublicationTimelineData', () => {
    it('should fetch publication timeline data', async () => {
      const mockData = { labels: [], datasets: [] };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchPublicationTimelineData(1);

      expect(api.get).toHaveBeenCalledWith('/charts/publication-timeline/', {
        params: { reviewId: 1 },
      });
      expect(result).toEqual(mockData);
    });
  });
});
