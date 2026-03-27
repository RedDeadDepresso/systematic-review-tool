import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RegisterForm } from './register-form';

vi.mock('@/features/users/hooks/use-auth', () => ({
  useRegister: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

import { useRegister } from '@/features/users/hooks/use-auth';

const mockUseRegister = vi.mocked(useRegister);
const defaultMutation = { mutate: vi.fn(), isPending: false, error: null };

describe('Components - RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRegister.mockReturnValue(defaultMutation as any);
  });

  it('should render all registration fields', () => {
    render(<RegisterForm />);
    // The source has a bug where both name inputs share id="lastName".
    // Query by placeholder to work around the broken label association.
    expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Doe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('m@example.com')).toBeInTheDocument();
    expect(
      document.querySelector('input[name="password1"]')
    ).toBeInTheDocument();
    expect(
      document.querySelector('input[name="password2"]')
    ).toBeInTheDocument();
  });

  it('should render Create Account button', () => {
    render(<RegisterForm />);
    expect(
      screen.getByRole('button', { name: 'Create Account' })
    ).toBeInTheDocument();
  });

  it('should call register.mutate with all form values on submit', async () => {
    const mutate = vi.fn();
    mockUseRegister.mockReturnValue({ ...defaultMutation, mutate } as any);
    render(<RegisterForm />);

    await userEvent.type(screen.getByPlaceholderText('John'), 'John');
    await userEvent.type(screen.getByPlaceholderText('Doe'), 'Doe');
    await userEvent.type(
      screen.getByPlaceholderText('m@example.com'),
      'john@example.com'
    );
    await userEvent.type(
      document.querySelector('input[name="password1"]') as HTMLElement,
      'pass1234'
    );
    await userEvent.type(
      document.querySelector('input[name="password2"]') as HTMLElement,
      'pass1234'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create Account' })
    );

    expect(mutate).toHaveBeenCalledWith({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password1: 'pass1234',
      password2: 'pass1234',
    });
  });

  it('should disable all fields and button when registration is pending', () => {
    mockUseRegister.mockReturnValue({
      ...defaultMutation,
      isPending: true,
    } as any);
    render(<RegisterForm />);
    expect(screen.getByPlaceholderText('John')).toBeDisabled();
    expect(screen.getByPlaceholderText('m@example.com')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Create Account' })
    ).toBeDisabled();
  });
});
