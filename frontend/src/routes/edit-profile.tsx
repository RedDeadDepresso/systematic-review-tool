// Authenticated route for editing the current user's profile.
import { redirectUnauthenticated } from '@/features/users/api/auth';
import { EditProfileForm } from '@/features/users/components/edit-profile-form';
import { AppLayoutContext } from '@/context/app-layout-context';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';

export const Route = createFileRoute('/edit-profile')({
  component: RouteComponent,
  beforeLoad: redirectUnauthenticated,
});

function RouteComponent() {
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('Edit Profile');
    setIsAuthenticated(true);
    setScroll(true);
  }, []);

  return <EditProfileForm />;
}
