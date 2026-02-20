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
import { useChangePassword } from '@/features/users/hooks/use-auth';
import { useState } from 'react';
import { errorMessage } from '@/components/shared/error-message';

export function ChangePasswordForm() {
  const changePassword = useChangePassword();
  const [form, setForm] = useState({
    newPassword1: '',
    newPassword2: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    changePassword.mutate(form, {
      onSuccess: () => {
        setForm({ newPassword1: '', newPassword2: '' });
      },
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>
          Enter your new password below to update your account
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
                disabled={changePassword.isPending}
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
                disabled={changePassword.isPending}
              />
              <FieldDescription>
                Please confirm your new password.
              </FieldDescription>
            </Field>
            <Field>
              <Button type="submit" disabled={changePassword.isPending}>
                Change Password
              </Button>
            </Field>
            {changePassword.error && errorMessage(changePassword.error)}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
