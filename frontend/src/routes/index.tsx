import { createFileRoute } from '@tanstack/react-router';
import { ReviewTable } from '@/features/reviews/components/reviews/review-table';
import { useFetchReviews } from '@/features/reviews/hooks/use-reviews';
import { useContext, useEffect } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchInvitations } from '@/features/reviews/hooks/use-invitations';
import { InvitationTable } from '@/features/reviews/components/review-invitations/invitation-table';
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
      {!isLoadingActive && <ReviewTable data={activeReviews} isActive={true} />}
      <h2 className="text-2xl font-semibold mb-4 text-foreground">
        Inactive Reviews
      </h2>
      {!isLoadingInactive && (
        <ReviewTable data={inactiveReviews} isActive={false} />
      )}
      <h2 className="text-2xl font-semibold mb-4 text-foreground">
        Invitations
      </h2>
      {!isLoadingInvitations && <InvitationTable data={invitations} />}
    </>
  );
}
