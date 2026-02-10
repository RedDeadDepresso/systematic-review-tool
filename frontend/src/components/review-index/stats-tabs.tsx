'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReviewScreeningStatsChart } from './screening-stats-chart';
import { ReviewOpinionStatsChart } from './opinion-stats-chart';
import type { ScreeningStat, OpinionStats } from '@/types/screening-stat';
import { Clock, FileCheck, FileText } from 'lucide-react';

interface StatsTabsProps {
  screeningStats: ScreeningStat[];
  screeningOpinions: OpinionStats[];
  fullTextOpinions: OpinionStats[];
}

export function StatsTabs({
  screeningStats,
  screeningOpinions,
  fullTextOpinions,
}: StatsTabsProps) {
  return (
    <Tabs defaultValue="time" className="w-full">
      <TabsList className="grid w-full grid-cols-3 h-auto">
        <TabsTrigger
          value="time"
          className="gap-1 sm:gap-2 flex-col sm:flex-row py-2"
        >
          <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="text-xs sm:text-sm">Time</span>
        </TabsTrigger>
        <TabsTrigger
          value="screening"
          className="gap-1 sm:gap-2 flex-col sm:flex-row py-2"
        >
          <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="text-xs sm:text-sm">Screening</span>
        </TabsTrigger>
        <TabsTrigger
          value="fulltext"
          className="gap-1 sm:gap-2 flex-col sm:flex-row py-2"
        >
          <FileCheck className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="text-xs sm:text-sm">Full-Text</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="time" className="mt-4 sm:mt-6">
        <ReviewScreeningStatsChart stats={screeningStats} />
      </TabsContent>

      <TabsContent value="screening" className="mt-4 sm:mt-6">
        <ReviewOpinionStatsChart
          opinions={screeningOpinions}
          stage="screening"
        />
      </TabsContent>

      <TabsContent value="fulltext" className="mt-4 sm:mt-6">
        <ReviewOpinionStatsChart
          opinions={fullTextOpinions}
          stage="full-text"
        />
      </TabsContent>
    </Tabs>
  );
}
