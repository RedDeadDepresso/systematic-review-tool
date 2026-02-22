import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useLogin } from '@/features/users/hooks/use-auth';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { errorMessage } from '@/components/blocks/error-message';

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const login = useLogin();
  const [form, setForm] = useState({ email: '', password: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(form);
  };

  return (
    <div
      className={cn('flex flex-col gap-6 w-full max-w-2xl mx-auto', className)}
      {...props}
    >
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="m@example.com"
                  required
                  onChange={handleChange}
                  disabled={login.isPending}
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Link
                    to="/request-password-reset"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  required
                  onChange={handleChange}
                  disabled={login.isPending}
                />
              </Field>
              <Field>
                <Button type="submit" disabled={login.isPending}>
                  Login
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{' '}
                  <Link to="/register">Sign up</Link>
                </FieldDescription>
              </Field>
              {login.error && errorMessage(login.error)}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
