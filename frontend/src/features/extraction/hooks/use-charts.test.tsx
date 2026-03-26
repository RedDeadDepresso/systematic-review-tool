import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/extraction/api/charts';
import {
  useFetchBarChart,
  useFetchScatterPlot,
  useFetchEvidenceGapMap,
  useFetchPublicationTimeline,
} from './use-charts';
import React from 'react';

vi.mock('@/features/extraction/api/charts', () => ({
  fetchBarChartData: vi.fn(),
  fetchScatterPlotData: vi.fn(),
  fetchEvidenceGapMapData: vi.fn(),
  fetchPublicationTimelineData: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-charts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchBarChart', () => {
    it('should query correctly isolating endpoints locally', async () => {
      const mockData = { labels: [] } as any;
      vi.mocked(api.fetchBarChartData).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchBarChart(10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchBarChartData).toHaveBeenCalledWith(10);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useFetchScatterPlot', () => {
    it('should inject schema cleanly resolving inputs naturally', async () => {
      const mockData = { points: [] } as any;
      vi.mocked(api.fetchScatterPlotData).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchScatterPlot(1, 2, 10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchScatterPlotData).toHaveBeenCalledWith(1, 2, 10);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useFetchEvidenceGapMap', () => {
    it('should load definitions natively fetching correctly', async () => {
      const mockData = { matrix: [] } as any;
      vi.mocked(api.fetchEvidenceGapMapData).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchEvidenceGapMap(1, 2, 10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchEvidenceGapMapData).toHaveBeenCalledWith(1, 2, 10);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useFetchPublicationTimeline', () => {
    it('should evaluate configurations natively requesting graphs accurately', async () => {
      const mockData = { timeline: [] } as any;
      vi.mocked(api.fetchPublicationTimelineData).mockResolvedValueOnce(
        mockData
      );

      const { result } = renderHook(() => useFetchPublicationTimeline(10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchPublicationTimelineData).toHaveBeenCalledWith(10);
      expect(result.current.data).toEqual(mockData);
    });
  });
});
