import { createFileRoute, redirect } from '@tanstack/react-router';
import { ReviewTable } from '@/components/index/review-table';
import { useFetchReviews } from '@/hooks/use-review';
import { useContext, useEffect } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchInvitations } from '@/hooks/use-invitation';
import { InvitationTable } from '@/components/index/invitation-table';

export const Route = createFileRoute('/')({
  component: IndexPage,
  beforeLoad: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) throw redirect({ to: '/login' });
  },
});

function IndexPage() {
  const { data: activeReviews, isLoading: isLoadingActive } = useFetchReviews({
    isActive: true,
  });
  const { data: inactiveReviews, isLoading: isLoadingInactive } =
    useFetchReviews({
      isActive: false,
    });
  const { data: invitations, isLoading: isLoadingInvitations } =
    useFetchInvitations();

  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('Home');
    setIsAuthenticated(true);
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
      {!isLoadingInvitations && <InvitationTable data={invitations ?? []} />}
    </>
  );
}
