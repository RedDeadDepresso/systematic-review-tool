import { AppLayout } from '@/components/app-layout';
import { ReferenceTable } from '@/components/reference-table';
import { useFetchReferences } from '@/hooks/use-reference';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/review-data/$reviewId')({
  component: RouteComponent,
});

function RouteComponent() {
  const { reviewId } = Route.useParams();
  const reviewIdNum = Number(reviewId);
  const { data, isLoading } = useFetchReferences({ reviewId: reviewId });
  return (
    <AppLayout pageTitle="Review Data" isAuthenticated={true}>
      {!isLoading && <ReferenceTable reviewId={reviewIdNum} data={data} />}
    </AppLayout>
  );
}
