// Dashboard that composes all extraction chart panels.
import {
  BarChart3,
  ScatterChart as ScatterChartIcon,
  Grid3x3,
  TrendingUp,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChartPanel } from '@/features/extraction/components/charts/bar-chart-panel';
import { ScatterPlotPanel } from '@/features/extraction/components/charts/scatter-plot-panel';
import { EvidenceGapMapPanel } from '@/features/extraction/components/charts/evidence-gap-map-panel';
import { PublicationTimelinePanel } from '@/features/extraction/components/charts/publication-timeline-panel';

interface ExtractionChartsDashboardProps {
  reviewId: number;
}

export function ExtractionChartsDashboard({
  reviewId,
}: ExtractionChartsDashboardProps) {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Extraction Charts
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualise your extraction answers across references
          </p>
        </div>

        <Tabs defaultValue="bar" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto">
            <TabsTrigger value="bar" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Bar Chart</span>
            </TabsTrigger>
            <TabsTrigger value="scatter" className="gap-2">
              <ScatterChartIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Scatter / Bubble</span>
            </TabsTrigger>
            <TabsTrigger value="gap" className="gap-2">
              <Grid3x3 className="h-4 w-4" />
              <span className="hidden sm:inline">Evidence Gap Map</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Timeline</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bar">
            <BarChartPanel reviewId={reviewId} />
          </TabsContent>

          <TabsContent value="scatter">
            <ScatterPlotPanel reviewId={reviewId} />
          </TabsContent>

          <TabsContent value="gap">
            <EvidenceGapMapPanel reviewId={reviewId} />
          </TabsContent>

          <TabsContent value="timeline">
            <PublicationTimelinePanel reviewId={reviewId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
