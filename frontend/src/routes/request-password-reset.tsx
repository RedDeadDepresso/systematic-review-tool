import { redirectAuthenticated } from '@/features/users/api/auth';
import { RequestPasswordResetForm } from '@/features/users/components/request-password-reset-form';
import { AppLayoutContext } from '@/context/app-layout-context';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';

export const Route = createFileRoute('/request-password-reset')({
  component: RouteComponent,
  beforeLoad: redirectAuthenticated,
});

function RouteComponent() {
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('Request Password Reset');
    setIsAuthenticated(false);
    setScroll(true);
  }, []);

  return <RequestPasswordResetForm />;
}
