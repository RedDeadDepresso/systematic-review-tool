import ScreeningInterface from '@/components/review-full-text-screening/screening-interface';
import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchKeywords } from '@/hooks/use-keyword';
import { useFetchReferences } from '@/hooks/use-reference';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';

export const Route = createFileRoute('/reviews/$reviewId/full-text-screening')({
  component: RouteComponent,
});

function RouteComponent() {
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);
  setPageTitle('Screening');
  setIsAuthenticated(true);

  const { reviewId } = Route.useParams();
  const reviewIdNum = Number(reviewId);

  const { data: references, isLoading: refsLoading } = useFetchReferences({
    reviewId: reviewIdNum,
  });

  const { data: inclusiveKeywords, isLoading: inclusiveLoading } =
    useFetchKeywords({
      id: reviewIdNum,
      is_inclusive: true,
    });

  const { data: exclusiveKeywords, isLoading: exclusiveLoading } =
    useFetchKeywords({
      id: reviewIdNum,
      is_inclusive: false,
    });

  const isLoading = refsLoading || inclusiveLoading || exclusiveLoading;

  useEffect(() => {}, []);

  if (isLoading) return <div>Loading...</div>;
  if (!isLoading)
    return (
      <ScreeningInterface
        reviewId={reviewId}
        references={references}
        inclusiveKeywords={inclusiveKeywords}
        exclusiveKeywords={exclusiveKeywords}
      />
    );
}
