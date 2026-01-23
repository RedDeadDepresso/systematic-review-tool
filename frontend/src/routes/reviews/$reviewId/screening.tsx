import ScreeningInterface from '@/components/review-screening/screening-interface';
import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchKeywords } from '@/hooks/use-keyword';
import { useFetchReferences } from '@/hooks/use-reference';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';

export const Route = createFileRoute('/reviews/$reviewId/screening')({
  component: RouteComponent,
});

function RouteComponent() {
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);

  const reviewId = Number(Route.useParams()['reviewId']);

  const { data: references, isLoading: refsLoading } =
    useFetchReferences(reviewId);

  const { data: inclusiveKeywords, isLoading: inclusiveLoading } =
    useFetchKeywords({
      id: reviewId,
      isInclusive: true,
    });

  const { data: exclusiveKeywords, isLoading: exclusiveLoading } =
    useFetchKeywords({
      id: reviewId,
      isInclusive: false,
    });

  const isLoading = refsLoading || inclusiveLoading || exclusiveLoading;

  useEffect(() => {
    setPageTitle('Screening');
    setIsAuthenticated(true);
  }, []);

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
