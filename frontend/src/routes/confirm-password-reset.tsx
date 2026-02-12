import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { redirectAuthenticated } from '@/api/auth';
import { ConfirmPasswordResetForm } from '@/components/auth/confirm-password-reset-form';

type PasswordResetConfirmSearch = {
  uid: string;
  token: string;
};

export const Route = createFileRoute('/confirm-password-reset')({
  validateSearch: (
    search: Record<string, unknown>
  ): PasswordResetConfirmSearch => ({
    uid: search.uid as string,
    token: search.token as string,
  }),
  component: RouteComponent,
  beforeLoad: redirectAuthenticated,
});

function RouteComponent() {
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);
  const { uid, token } = Route.useSearch();

  useEffect(() => {
    setPageTitle('Confirm Password Reset');
    setIsAuthenticated(false);
  }, []);

  return <ConfirmPasswordResetForm uid={uid} token={token} />;
}
