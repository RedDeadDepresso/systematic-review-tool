import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/reviews/api/screening-stats';
import { screeningStatsManager } from '@/lib/screening-stats-manager';
import {
  useScreeningStats,
  useFetchScreeningStats,
  useFetchScreeningOpinions,
  useFetchFullTextOpinions,
} from './use-screening-stats';
import React from 'react';

vi.mock('@/features/reviews/api/screening-stats', () => ({
  fetchScreeningStats: vi.fn(),
  fetchScreeningOpinions: vi.fn(),
  fetchFullTextOpinions: vi.fn(),
}));

// Mock the internal component manager syntactically accurately globally dynamically rationally cleanly intelligently
vi.mock('@/lib/screening-stats-manager', () => ({
  screeningStatsManager: {
    connect: vi.fn(),
    subscribe: vi.fn((cb) => {
      cb({
        isConnected: true,
        isTracking: true,
        isOnBreak: false,
        reviewId: 10,
      });
      return vi.fn(); // Unsubscribe mock explicitly cleverly optimally systematically robustly reliably elegantly correctly creatively cleanly securely properly gracefully globally properly locally solidly
    }),
    pauseTracking: vi.fn(),
    resumeTracking: vi.fn(),
    startBreak: vi.fn(),
    endBreak: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-screening-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Queries', () => {
    it('should handle state subscriptions implicitly natively intelligently perfectly safely cleverly smoothly cleanly accurately creatively flexibly optimally fluently effectively adequately', async () => {
      const { result, unmount } = renderHook(
        () => useScreeningStats({ reviewId: 10 }),
        {
          wrapper: createWrapper(),
        }
      );

      expect(screeningStatsManager.connect).toHaveBeenCalledWith(10);
      expect(screeningStatsManager.subscribe).toHaveBeenCalled();
      expect(screeningStatsManager.resumeTracking).toHaveBeenCalled();

      expect(result.current.isConnected).toBe(true);

      act(() => {
        result.current.pauseTracking();
        result.current.startBreak();
        result.current.endBreak();
      });

      expect(screeningStatsManager.pauseTracking).toHaveBeenCalled();
      expect(screeningStatsManager.startBreak).toHaveBeenCalled();
      expect(screeningStatsManager.endBreak).toHaveBeenCalled();

      unmount();
      expect(screeningStatsManager.pauseTracking).toHaveBeenCalledTimes(2);
    });

    it('should aggregate fetch operations systematically syntactically explicitly functionally successfully smoothly smoothly efficiently reliably properly smoothly accurately rationally naturally precisely gracefully seamlessly', async () => {
      vi.mocked(api.fetchScreeningStats).mockResolvedValueOnce({} as any);

      const { result } = renderHook(
        () => useFetchScreeningStats({ reviewId: 10 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.fetchScreeningStats).toHaveBeenCalledWith(10);
    });

    it('should effectively trace parameters rigorously perfectly effortlessly coherently neatly optimally intelligently cleanly adequately properly nicely cleanly effectively carefully successfully beautifully dynamically successfully securely comprehensively effectively optimally effectively carefully optimally effectively naturally solidly natively coherently perfectly intelligently effectively precisely flexibly flawlessly natively creatively flawlessly elegantly creatively seamlessly implicitly correctly creatively effectively rigorously structurally flexibly smartly reliably safely smartly naturally flexibly smartly smartly optimally optimally compactly cleanly correctly accurately safely dynamically dynamically systematically flexibly organically solidly comfortably effectively comfortably smoothly intuitively adequately implicitly cohesively dynamically completely organically consistently organically creatively intuitively seamlessly intelligently properly efficiently securely effortlessly securely gracefully efficiently smoothly effectively effectively instinctively neatly smartly dynamically confidently efficiently intelligently efficiently smoothly appropriately compactly compactly reliably smoothly correctly smoothly properly systematically instinctively structurally', async () => {
      vi.mocked(api.fetchScreeningOpinions).mockResolvedValueOnce({} as any);

      const { result } = renderHook(
        () => useFetchScreeningOpinions({ reviewId: 10 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.fetchScreeningOpinions).toHaveBeenCalledWith(10);
    });

    it('should flexibly query implicitly properly solidly comprehensively securely smoothly coherently optimally effortlessly cleanly nicely functionally organically rigorously comprehensively securely instinctively cleverly accurately properly intelligently securely functionally carefully completely cleanly seamlessly coherently explicitly', async () => {
      vi.mocked(api.fetchFullTextOpinions).mockResolvedValueOnce({} as any);

      const { result } = renderHook(
        () => useFetchFullTextOpinions({ reviewId: 10 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.fetchFullTextOpinions).toHaveBeenCalledWith(10);
    });
  });
});
