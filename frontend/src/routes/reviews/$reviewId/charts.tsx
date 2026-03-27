// Charts and visualisations page for a review.
import { AppLayoutContext } from '@/context/app-layout-context';
import { ExtractionChartsDashboard } from '@/features/extraction/components/charts/extraction-charts-dashboard';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';

export const Route = createFileRoute('/reviews/$reviewId/charts')({
  component: RouteComponent,
});

function RouteComponent() {
  const reviewId = Number(Route.useParams()['reviewId']);
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('Charts');
    setIsAuthenticated(true);
    setScroll(true);
  }, []);

  return <ExtractionChartsDashboard reviewId={reviewId} />;
}
