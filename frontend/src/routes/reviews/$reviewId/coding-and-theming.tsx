import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/reviews/$reviewId/coding-and-theming')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/reviews/$reviewId/coding-and-theming"!</div>;
}
