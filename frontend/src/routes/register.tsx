import { RegisterForm } from '@/components/auth/register-form';
import { AppLayoutContext } from '@/context/app-layout-context';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';

export const Route = createFileRoute('/register')({
  component: RegisterPage,
  beforeLoad: async () => {
    const token = localStorage.getItem('access_token');
    if (token) throw redirect({ to: '/' });
  },
});

function RegisterPage() {
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);
  useEffect(() => {
    setPageTitle('Register');
    setIsAuthenticated(false);
  }, []);
  return <RegisterForm />;
}
