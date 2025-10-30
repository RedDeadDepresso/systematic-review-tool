import { createFileRoute, redirect } from '@tanstack/react-router';
import { ReviewTable } from '@/components/review-table';
import { useFetchReviews } from '@/hooks/use-review';
import { useContext, useEffect } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';

export const Route = createFileRoute('/')({
  component: IndexPage,
  beforeLoad: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) throw redirect({ to: '/login' });
  },
});

function IndexPage() {
  const { data: activeReviews, isLoading: isLoadingActive } = useFetchReviews({
    is_active: true,
  });
  const { data: inactiveReviews, isLoading: isLoadingInactive } =
    useFetchReviews({
      is_active: false,
    });

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
    </>
  );
}
