import { createFileRoute } from '@tanstack/react-router';
import { ReviewsTable } from '@/features/reviews/components/reviews/reviews-table';
import { useFetchReviews } from '@/features/reviews/hooks/use-reviews';
import { useContext, useEffect } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchInvitations } from '@/features/reviews/hooks/use-invitations';
import { InvitationsTable } from '@/features/reviews/components/review-invitations/invitations-table';
import { redirectUnauthenticated } from '@/features/users/api/auth';

export const Route = createFileRoute('/')({
  component: IndexPage,
  beforeLoad: redirectUnauthenticated,
});

function IndexPage() {
  const { data: activeReviews = [], isLoading: isLoadingActive } =
    useFetchReviews({
      isActive: true,
    });
  const { data: inactiveReviews = [], isLoading: isLoadingInactive } =
    useFetchReviews({
      isActive: false,
    });
  const { data: invitations = [], isLoading: isLoadingInvitations } =
    useFetchInvitations();

  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('Home');
    setIsAuthenticated(true);
    setScroll(true);
  }, []);

  return (
    <>
      <h2 className="text-2xl font-semibold mb-4 text-foreground">
        Active Reviews
      </h2>
      <ReviewsTable
        data={activeReviews}
        isActive={true}
        isLoading={isLoadingActive}
      />
      <h2 className="text-2xl font-semibold mb-4 text-foreground">
        Inactive Reviews
      </h2>
      <ReviewsTable
        data={inactiveReviews}
        isActive={false}
        isLoading={isLoadingInactive}
      />
      <h2 className="text-2xl font-semibold mb-4 text-foreground">
        Invitations
      </h2>
      <InvitationsTable data={invitations} isLoading={isLoadingInvitations} />
    </>
  );
}
