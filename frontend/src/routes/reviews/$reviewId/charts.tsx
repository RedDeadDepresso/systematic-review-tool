import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/reviews/$reviewId/charts')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/reviews/$reviewId/analysis"!</div>;
}
