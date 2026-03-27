import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';

vi.mock('@/features/users/hooks/use-auth', () => ({
  useLogin: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

import { useLogin } from '@/features/users/hooks/use-auth';

const mockUseLogin = vi.mocked(useLogin);

const defaultMutation = { mutate: vi.fn(), isPending: false, error: null };

describe('Components - LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLogin.mockReturnValue(defaultMutation as any);
  });

  it('should render email and password fields', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('should render the login submit button', () => {
    render(<LoginForm />);
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });

  it('should render a forgot password link', () => {
    render(<LoginForm />);
    expect(screen.getByText('Forgot your password?')).toBeInTheDocument();
  });

  it('should call login.mutate with form values on submit', async () => {
    const mutate = vi.fn();
    mockUseLogin.mockReturnValue({ ...defaultMutation, mutate } as any);

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(mutate).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret123',
    });
  });

  it('should disable fields and button when login is pending', () => {
    mockUseLogin.mockReturnValue({
      ...defaultMutation,
      isPending: true,
    } as any);
    render(<LoginForm />);
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled();
  });
});
