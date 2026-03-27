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

export const screeningStatsKeys = {
  stats: (reviewId: number) => ['review-screening-stats', reviewId] as const,
  opinions: (reviewId: number) =>
    ['review-screening-opinions', reviewId] as const,
  fullTextOpinions: (reviewId: number) =>
    ['review-fulltext-opinions', reviewId] as const,
};

export function useScreeningStats({
  reviewId,
  autoTrack = true,
}: {
  reviewId: number;
  autoTrack?: boolean;
}) {
  const [state, setState] = useState<ScreeningStatsState>({
    isConnected: false,
    isTracking: false,
    isOnBreak: false,
    reviewId: null,
  });

  useEffect(() => {
    screeningStatsManager.connect(reviewId);
    const unsubscribe = screeningStatsManager.subscribe(setState);
    if (autoTrack) screeningStatsManager.resumeTracking();

    return () => {
      if (autoTrack) screeningStatsManager.pauseTracking();
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
}) =>
  useQuery({
    queryKey: screeningStatsKeys.stats(reviewId),
    queryFn: () => fetchScreeningStats(reviewId),
    enabled: enabled && !!reviewId,
  });

export const useFetchScreeningOpinions = ({
  reviewId,
  enabled = true,
}: {
  reviewId: number;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: screeningStatsKeys.opinions(reviewId),
    queryFn: () => fetchScreeningOpinions(reviewId),
    enabled: enabled && !!reviewId,
  });

export const useFetchFullTextOpinions = ({
  reviewId,
  enabled = true,
}: {
  reviewId: number;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: screeningStatsKeys.fullTextOpinions(reviewId),
    queryFn: () => fetchFullTextOpinions(reviewId),
    enabled: enabled && !!reviewId,
  });
