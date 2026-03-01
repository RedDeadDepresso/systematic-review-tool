import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReviewScreeningStatsChart } from '@/features/reviews/components/screening-stats/screening-stats-chart';
import { ReviewOpinionStatsChart } from '@/features/reviews/components/screening-stats/opinion-stats-chart';
import { Clock, FileCheck, FileText } from 'lucide-react';
import { useState } from 'react';
import {
  useFetchFullTextOpinions,
  useFetchScreeningOpinions,
  useFetchScreeningStats,
} from '@/features/reviews/hooks/use-screening-stats';
import { Skeleton } from '@/components/ui/skeleton';

interface StatsTabsProps {
  reviewId: number;
}

function StatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Skeleton className="h-16 w-32" />
        <Skeleton className="h-16 w-32" />
      </div>
      <Skeleton className="h-100 w-full" />
    </div>
  );
}

export function StatsTabs({ reviewId }: StatsTabsProps) {
  const [screeningOpinionsEnabled, setScreeningOpinionsEnabled] =
    useState(false);
  const [fullTextOpinionsEnabled, setFullTextOpinionsEnabled] = useState(false);
  const fetchScreeningStats = useFetchScreeningStats({
    reviewId,
    enabled: true,
  });
  const fetchscreeningOpinions = useFetchScreeningOpinions({
    reviewId,
    enabled: screeningOpinionsEnabled,
  });
  const fetchfullTextOpinions = useFetchFullTextOpinions({
    reviewId,
    enabled: fullTextOpinionsEnabled,
  });

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
          onClick={() => setScreeningOpinionsEnabled(true)}
        >
          <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="text-xs sm:text-sm">Screening</span>
        </TabsTrigger>
        <TabsTrigger
          value="fulltext"
          className="gap-1 sm:gap-2 flex-col sm:flex-row py-2"
          onClick={() => setFullTextOpinionsEnabled(true)}
        >
          <FileCheck className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="text-xs sm:text-sm">Full-Text</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="time" className="mt-4 sm:mt-6">
        {fetchScreeningStats.isLoading ? (
          <StatsSkeleton />
        ) : (
          <ReviewScreeningStatsChart stats={fetchScreeningStats.data || []} />
        )}
      </TabsContent>

      <TabsContent value="screening" className="mt-4 sm:mt-6">
        {fetchscreeningOpinions.isLoading ? (
          <StatsSkeleton />
        ) : (
          <ReviewOpinionStatsChart
            opinions={fetchscreeningOpinions.data || []}
            stage="screening"
          />
        )}
      </TabsContent>

      <TabsContent value="fulltext" className="mt-4 sm:mt-6">
        {fetchfullTextOpinions.isLoading ? (
          <StatsSkeleton />
        ) : (
          <ReviewOpinionStatsChart
            opinions={fetchfullTextOpinions.data || []}
            stage="full-text"
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
