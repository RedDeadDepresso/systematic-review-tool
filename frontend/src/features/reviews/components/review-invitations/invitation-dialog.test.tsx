import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import InvitationDialog from './invitation-dialog';

vi.mock('@/features/reviews/hooks/use-review-invitations', () => ({
  useSendInvitations: vi.fn(),
}));

import { useSendInvitations } from '@/features/reviews/hooks/use-review-invitations';

const mockUseSendInvitations = vi.mocked(useSendInvitations);

const defaultMutation = {
  mutate: vi.fn(),
  isPending: false,
};

describe('Components - InvitationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSendInvitations.mockReturnValue(defaultMutation as any);
  });

  it('should render the dialog when open', () => {
    render(
      <InvitationDialog reviewId={1} open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByText('Send Invitations')).toBeInTheDocument();
  });

  it('should not render dialog content when closed', () => {
    render(
      <InvitationDialog reviewId={1} open={false} onOpenChange={vi.fn()} />
    );
    expect(screen.queryByText('Send Invitations')).not.toBeInTheDocument();
  });

  it('should disable Send Invites button when no emails are entered', () => {
    render(
      <InvitationDialog reviewId={1} open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Send Invites' })).toBeDisabled();
  });

  it('should enable Send Invites after a valid email is added', async () => {
    render(
      <InvitationDialog reviewId={1} open={true} onOpenChange={vi.fn()} />
    );
    await userEvent.type(
      screen.getByPlaceholderText('Type an email and press Enter'),
      'user@example.com{Enter}'
    );
    expect(screen.getByRole('button', { name: 'Send Invites' })).toBeEnabled();
  });

  it('should call mutate with reviewId, emails and role on submit', async () => {
    const mutate = vi.fn();
    mockUseSendInvitations.mockReturnValue({
      ...defaultMutation,
      mutate,
    } as any);

    render(
      <InvitationDialog reviewId={7} open={true} onOpenChange={vi.fn()} />
    );
    await userEvent.type(
      screen.getByPlaceholderText('Type an email and press Enter'),
      'alice@example.com{Enter}'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send Invites' }));

    expect(mutate).toHaveBeenCalledWith(
      { review: 7, emails: ['alice@example.com'], role: 'collaborator' },
      expect.any(Object)
    );
  });

  it('should show Sending... when mutation is pending', () => {
    mockUseSendInvitations.mockReturnValue({
      ...defaultMutation,
      isPending: true,
    } as any);

    render(
      <InvitationDialog reviewId={1} open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByText('Sending...')).toBeInTheDocument();
  });
});
