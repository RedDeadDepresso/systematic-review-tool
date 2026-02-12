import { redirectAuthenticated } from '@/api/auth';
import { RequestPasswordResetForm } from '@/components/auth/request-password-reset-form';
import { AppLayoutContext } from '@/context/app-layout-context';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';

export const Route = createFileRoute('/request-password-reset')({
  component: RouteComponent,
  beforeLoad: redirectAuthenticated,
});

function RouteComponent() {
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('Request Password Reset');
    setIsAuthenticated(false);
  }, []);

  return <RequestPasswordResetForm />;
}
