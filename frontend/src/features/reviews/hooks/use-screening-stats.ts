import { useEffect, useState } from 'react';
import {
  screeningStatsManager,
  type ScreeningStatsState,
} from '@/lib/screening-stats-manager';
import { useQuery } from '@tanstack/react-query';
import {
  fetchFullTextOpinions,
  fetchScreeningOpinions,
  fetchScreeningStats,
} from '@/features/reviews/api/screening-stats';

interface UseScreeningStatsOptions {
  reviewId: number;
  autoTrack?: boolean; // Auto start/stop tracking when component mounts/unmounts
}

export function useScreeningStats({
  reviewId,
  autoTrack = true,
}: UseScreeningStatsOptions) {
  const [state, setState] = useState<ScreeningStatsState>({
    isConnected: false,
    isTracking: false,
    isOnBreak: false,
    reviewId: null,
  });

  useEffect(() => {
    // Connect to WebSocket
    screeningStatsManager.connect(reviewId);

    // Subscribe to state changes
    const unsubscribe = screeningStatsManager.subscribe(setState);

    // Auto-track if enabled
    if (autoTrack) {
      screeningStatsManager.resumeTracking();
    }

    return () => {
      // Auto-pause if enabled
      if (autoTrack) {
        screeningStatsManager.pauseTracking();
      }
      unsubscribe();
    };
  }, [reviewId, autoTrack]);

  return {
    ...state,
    startBreak: () => screeningStatsManager.startBreak(),
    endBreak: () => screeningStatsManager.endBreak(),
    pauseTracking: () => screeningStatsManager.pauseTracking(),
    resumeTracking: () => screeningStatsManager.resumeTracking(),
  };
}

export const useFetchScreeningStats = ({
  reviewId,
  enabled = true,
}: {
  reviewId: number;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: ['review-screening-stats', reviewId],
    queryFn: () => fetchScreeningStats(reviewId),
    enabled: enabled && !!reviewId,
  });
};

export const useFetchScreeningOpinions = ({
  reviewId,
  enabled = true,
}: {
  reviewId: number;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: ['review-screening-opinions', reviewId],
    queryFn: () => fetchScreeningOpinions(reviewId),
    enabled: enabled && !!reviewId,
  });
};

export const useFetchFullTextOpinions = ({
  reviewId,
  enabled = true,
}: {
  reviewId: number;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: ['review-fulltext-opinions', reviewId],
    queryFn: () => fetchFullTextOpinions(reviewId),
    enabled: enabled && !!reviewId,
  });
};
