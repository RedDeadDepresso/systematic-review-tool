import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginForm } from '@/components/login-form';
import { useContext, useEffect } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';

export const Route = createFileRoute('/login')({
  component: LoginPage,
  beforeLoad: async () => {
    const token = localStorage.getItem('access_token');
    if (token) throw redirect({ to: '/' });
  },
});

function LoginPage() {
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('Login');
    setIsAuthenticated(false);
  }, []);

  return <LoginForm />;
}
