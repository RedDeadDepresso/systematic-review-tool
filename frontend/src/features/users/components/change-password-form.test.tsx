import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChangePasswordForm } from './change-password-form';

vi.mock('@/features/users/hooks/use-auth', () => ({
  useChangePassword: vi.fn(),
}));

import { useChangePassword } from '@/features/users/hooks/use-auth';

const mockUseChangePassword = vi.mocked(useChangePassword);
const defaultMutation = { mutate: vi.fn(), isPending: false, error: null };

describe('Components - ChangePasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChangePassword.mockReturnValue(defaultMutation as any);
  });

  it('should render new password and confirm password fields', () => {
    render(<ChangePasswordForm />);
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
  });

  it('should render the Change Password button', () => {
    render(<ChangePasswordForm />);
    expect(
      screen.getByRole('button', { name: 'Change Password' })
    ).toBeInTheDocument();
  });

  it('should call mutate with new password values on submit', async () => {
    const mutate = vi.fn();
    mockUseChangePassword.mockReturnValue({
      ...defaultMutation,
      mutate,
    } as any);
    render(<ChangePasswordForm />);

    await userEvent.type(screen.getByLabelText('New Password'), 'newpass123');
    await userEvent.type(
      screen.getByLabelText('Confirm New Password'),
      'newpass123'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Change Password' })
    );

    expect(mutate).toHaveBeenCalledWith(
      { newPassword1: 'newpass123', newPassword2: 'newpass123' },
      expect.any(Object)
    );
  });

  it('should disable fields and button while pending', () => {
    mockUseChangePassword.mockReturnValue({
      ...defaultMutation,
      isPending: true,
    } as any);
    render(<ChangePasswordForm />);
    expect(screen.getByLabelText('New Password')).toBeDisabled();
    expect(screen.getByLabelText('Confirm New Password')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Change Password' })
    ).toBeDisabled();
  });
});
