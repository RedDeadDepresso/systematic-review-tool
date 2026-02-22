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
import { useRequestPasswordReset } from '@/features/users/hooks/use-auth';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { errorMessage } from '@/components/blocks/error-message';

export function RequestPasswordResetForm() {
  const requestReset = useRequestPasswordReset();
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestReset.mutate(
      { email },
      {
        onSuccess: () => {
          setEmail('');
        },
      }
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
        <CardDescription>
          Enter your email address and we'll send you a link to reset your
          password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={requestReset.isPending}
              />
            </Field>
            <FieldGroup>
              <Field>
                <Button type="submit" disabled={requestReset.isPending}>
                  Send Reset Link
                </Button>
                <FieldDescription className="px-6 text-center">
                  Remember your password? <Link to="/login">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
            {requestReset.error && errorMessage(requestReset.error)}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
