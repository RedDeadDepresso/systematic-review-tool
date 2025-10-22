import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginForm } from '@/components/login-form';
import { AppLayout } from '@/components/app-layout';

export const Route = createFileRoute('/login')({
  component: LoginPage,
  beforeLoad: async () => {
    const token = localStorage.getItem('access_token');
    if (token) throw redirect({ to: '/' });
  },
});

function LoginPage() {
  return (
    <AppLayout pageTitle="Login" isAuthenticated={false}>
      <LoginForm />
    </AppLayout>
  );
}
