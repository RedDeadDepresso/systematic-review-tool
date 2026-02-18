import { createFileRoute } from '@tanstack/react-router';
import { LoginForm } from '@/components/auth/login-form';
import { useContext, useEffect } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { redirectAuthenticated } from '@/api/auth';

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
