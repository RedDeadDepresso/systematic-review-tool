import { ReferenceTable } from '@/components/review-data/reference-table';
import { ReviewNavigationMenu } from '@/components/review-index/review-navigation-menu';
import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchReferences } from '@/hooks/use-reference';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';

export const Route = createFileRoute('/reviews/$reviewId/review-data')({
  component: RouteComponent,
});

function RouteComponent() {
  const reviewId = Number(Route.useParams()['reviewId']);
  const { data, isLoading } = useFetchReferences(reviewId);
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('Review Data');
    setIsAuthenticated(true);
  }, []);

  return (
    <>
      <ReviewNavigationMenu reviewId={reviewId} />
      <>{!isLoading && <ReferenceTable reviewId={reviewId} data={data} />}</>
    </>
  );
}
