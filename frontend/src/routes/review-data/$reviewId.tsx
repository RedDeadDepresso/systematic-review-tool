import { ReferenceTable } from '@/components/reference-table';
import { ReviewNavigationMenu } from '@/components/review-navigation-menu';
import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchReferences } from '@/hooks/use-reference';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';

export const Route = createFileRoute('/review-data/$reviewId')({
  component: RouteComponent,
});

function RouteComponent() {
  const { reviewId } = Route.useParams();
  const reviewIdNum = Number(reviewId);
  const { data, isLoading } = useFetchReferences({ reviewId: reviewId });
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);
  useEffect(() => {
    setPageTitle('Review Data');
    setIsAuthenticated(true);
  }, []);

  return (
    <>
      <ReviewNavigationMenu reviewId={reviewId} />
      <>{!isLoading && <ReferenceTable reviewId={reviewIdNum} data={data} />}</>
    </>
  );
}
