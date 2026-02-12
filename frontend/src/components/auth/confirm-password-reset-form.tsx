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
import { useConfirmPasswordReset } from '@/hooks/use-auth';
import { useState } from 'react';
import { errorMessage } from '../shared/error-message';

interface ConfirmPasswordResetFormProps {
  uid: string;
  token: string;
}

export function ConfirmPasswordResetForm({
  uid,
  token,
}: ConfirmPasswordResetFormProps) {
  const confirmReset = useConfirmPasswordReset();
  const [form, setForm] = useState({
    newPassword1: '',
    newPassword2: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    confirmReset.mutate({
      ...form,
      uid,
      token,
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Set New Password</CardTitle>
        <CardDescription>
          Enter your new password below to complete the reset
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="newPassword1">New Password</FieldLabel>
              <Input
                id="newPassword1"
                name="newPassword1"
                type="password"
                required
                value={form.newPassword1}
                onChange={handleChange}
                disabled={confirmReset.isPending}
              />
              <FieldDescription>
                Must be at least 8 characters long.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="newPassword2">
                Confirm New Password
              </FieldLabel>
              <Input
                id="newPassword2"
                name="newPassword2"
                type="password"
                required
                value={form.newPassword2}
                onChange={handleChange}
                disabled={confirmReset.isPending}
              />
              <FieldDescription>
                Please confirm your new password.
              </FieldDescription>
            </Field>
            <Field>
              <Button type="submit" disabled={confirmReset.isPending}>
                Reset Password
              </Button>
            </Field>
            {confirmReset.error && errorMessage(confirmReset.error)}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
