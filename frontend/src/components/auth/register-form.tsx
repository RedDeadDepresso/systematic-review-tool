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
import { useRegister } from '@/hooks/use-auth';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { errorMessage } from '../shared/error-message';

export function RegisterForm() {
  const register = useRegister();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password1: '',
    password2: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate(form);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="firstName">First Name</FieldLabel>
              <Input
                id="lastName"
                name="firstName"
                type="text"
                placeholder="John"
                required
                onChange={handleChange}
                disabled={register.isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                placeholder="Doe"
                required
                onChange={handleChange}
                disabled={register.isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
                onChange={handleChange}
                disabled={register.isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password1">Password</FieldLabel>
              <Input
                id="password1"
                name="password1"
                type="password"
                required
                onChange={handleChange}
                disabled={register.isPending}
              />
              <FieldDescription>
                Must be at least 8 characters long.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="password2">Confirm Password</FieldLabel>
              <Input
                id="password2"
                name="password2"
                type="password"
                required
                onChange={handleChange}
                disabled={register.isPending}
              />
              <FieldDescription>Please confirm your password.</FieldDescription>
            </Field>
            <FieldGroup>
              <Field>
                <Button type="submit" disabled={register.isPending}>
                  Create Account
                </Button>
                <FieldDescription className="px-6 text-center">
                  Already have an account? <Link to="/login">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
            {register.error && errorMessage(register.error)}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
