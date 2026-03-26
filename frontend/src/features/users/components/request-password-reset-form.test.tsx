import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RequestPasswordResetForm } from './request-password-reset-form';

vi.mock('@/features/users/hooks/use-auth', () => ({
  useRequestPasswordReset: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

import { useRequestPasswordReset } from '@/features/users/hooks/use-auth';

const mockUseRequestPasswordReset = vi.mocked(useRequestPasswordReset);
const defaultMutation = { mutate: vi.fn(), isPending: false, error: null };

describe('Components - RequestPasswordResetForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRequestPasswordReset.mockReturnValue(defaultMutation as any);
  });

  it('should render the email input', () => {
    render(<RequestPasswordResetForm />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('should render the Send Reset Link button', () => {
    render(<RequestPasswordResetForm />);
    expect(
      screen.getByRole('button', { name: 'Send Reset Link' })
    ).toBeInTheDocument();
  });

  it('should call mutate with email on submit', async () => {
    const mutate = vi.fn();
    mockUseRequestPasswordReset.mockReturnValue({
      ...defaultMutation,
      mutate,
    } as any);
    render(<RequestPasswordResetForm />);

    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send Reset Link' })
    );

    expect(mutate).toHaveBeenCalledWith(
      { email: 'user@example.com' },
      expect.any(Object)
    );
  });

  it('should disable the button and field when pending', () => {
    mockUseRequestPasswordReset.mockReturnValue({
      ...defaultMutation,
      isPending: true,
    } as any);
    render(<RequestPasswordResetForm />);
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Send Reset Link' })
    ).toBeDisabled();
  });

  it('should link back to login page', () => {
    render(<RequestPasswordResetForm />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login'
    );
  });
});
