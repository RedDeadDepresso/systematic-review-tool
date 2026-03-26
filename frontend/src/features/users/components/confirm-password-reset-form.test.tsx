import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmPasswordResetForm } from './confirm-password-reset-form';

vi.mock('@/features/users/hooks/use-auth', () => ({
  useConfirmPasswordReset: vi.fn(),
}));

import { useConfirmPasswordReset } from '@/features/users/hooks/use-auth';

const mockUseConfirmPasswordReset = vi.mocked(useConfirmPasswordReset);
const defaultMutation = { mutate: vi.fn(), isPending: false, error: null };

describe('Components - ConfirmPasswordResetForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfirmPasswordReset.mockReturnValue(defaultMutation as any);
  });

  it('should render new password and confirm password fields', () => {
    render(<ConfirmPasswordResetForm uid="abc" token="tok" />);
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
  });

  it('should render the Reset Password submit button', () => {
    render(<ConfirmPasswordResetForm uid="abc" token="tok" />);
    expect(
      screen.getByRole('button', { name: 'Reset Password' })
    ).toBeInTheDocument();
  });

  it('should call mutate with passwords, uid, and token on submit', async () => {
    const mutate = vi.fn();
    mockUseConfirmPasswordReset.mockReturnValue({
      ...defaultMutation,
      mutate,
    } as any);
    render(<ConfirmPasswordResetForm uid="uid123" token="tok456" />);

    await userEvent.type(screen.getByLabelText('New Password'), 'newpass99');
    await userEvent.type(
      screen.getByLabelText('Confirm New Password'),
      'newpass99'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset Password' })
    );

    expect(mutate).toHaveBeenCalledWith({
      newPassword1: 'newpass99',
      newPassword2: 'newpass99',
      uid: 'uid123',
      token: 'tok456',
    });
  });

  it('should disable inputs and button while pending', () => {
    mockUseConfirmPasswordReset.mockReturnValue({
      ...defaultMutation,
      isPending: true,
    } as any);
    render(<ConfirmPasswordResetForm uid="abc" token="tok" />);
    expect(screen.getByLabelText('New Password')).toBeDisabled();
    expect(screen.getByLabelText('Confirm New Password')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Reset Password' })
    ).toBeDisabled();
  });
});
