import { ExtractionChartsDashboard } from '@/features/extraction/components/charts/extraction-charts-dashboard';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/reviews/$reviewId/charts')({
  component: RouteComponent,
});

function RouteComponent() {
  const reviewId = Number(Route.useParams()['reviewId']);
  return <ExtractionChartsDashboard reviewId={reviewId} />;
}
