import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { redirectUnauthenticated } from '@/api/auth';
import { ChangePasswordForm } from '@/components/auth/change-password-form';

export const Route = createFileRoute('/change-password')({
  component: RouteComponent,
  beforeLoad: redirectUnauthenticated,
});

function RouteComponent() {
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('Change Password');
    setIsAuthenticated(true);
    setScroll(true);
  }, []);

  return <ChangePasswordForm />;
}
