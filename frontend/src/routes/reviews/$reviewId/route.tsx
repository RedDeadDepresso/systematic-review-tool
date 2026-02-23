import { ReviewHeader } from '@/components/blocks/review-header';
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/reviews/$reviewId')({
  component: RouteComponent,
});

function RouteComponent() {
  const reviewId = Number(Route.useParams().reviewId);
  return (
    <>
      <ReviewHeader reviewId={reviewId} />
      <Outlet />
    </>
  );
}
