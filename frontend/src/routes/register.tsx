import { redirectAuthenticated } from '@/api/auth';
import { RegisterForm } from '@/components/auth/register-form';
import { AppLayoutContext } from '@/context/app-layout-context';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';

export const Route = createFileRoute('/register')({
  component: RegisterPage,
  beforeLoad: redirectAuthenticated,
});

function RegisterPage() {
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);
  useEffect(() => {
    setPageTitle('Register');
    setIsAuthenticated(false);
    setScroll(true);
  }, []);
  return <RegisterForm />;
}
