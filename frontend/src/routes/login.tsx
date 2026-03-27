// Login route (redirects authenticated users away).
import { createFileRoute } from '@tanstack/react-router';
import { LoginForm } from '@/features/users/components/login-form';
import { useContext, useEffect } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { redirectAuthenticated } from '@/features/users/api/auth';

export const Route = createFileRoute('/login')({
  component: LoginPage,
  beforeLoad: redirectAuthenticated,
});

function LoginPage() {
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('Login');
    setIsAuthenticated(false);
    setScroll(true);
  }, []);

  return <LoginForm />;
}
