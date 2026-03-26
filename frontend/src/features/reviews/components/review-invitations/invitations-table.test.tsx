import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ReceivedInvitationsTable,
  SentInvitationsTable,
} from './invitations-table';

vi.mock('@/features/reviews/hooks/use-review-invitations', () => ({
  useAcceptInvitation: vi.fn(),
  useDeclineInvitation: vi.fn(),
  useDeleteInvitation: vi.fn(),
}));

import {
  useAcceptInvitation,
  useDeclineInvitation,
  useDeleteInvitation,
} from '@/features/reviews/hooks/use-review-invitations';

const mockUseAcceptInvitation = vi.mocked(useAcceptInvitation);
const mockUseDeclineInvitation = vi.mocked(useDeclineInvitation);
const mockUseDeleteInvitation = vi.mocked(useDeleteInvitation);

const noopMutation = { mutate: vi.fn(), isPending: false };

// Invitation.review is a plain string (the review title), not an object
const mockReceivedInvitations = [
  {
    id: 1,
    review: 'Climate Review',
    invitedBy: 'Alice',
    role: 'reviewer',
    status: 'pending',
    email: 'bob@example.com',
    createdAt: '2024-01-01',
  },
];

const mockSentInvitations = [
  {
    id: 2,
    email: 'bob@example.com',
    role: 'collaborator',
    status: 'pending',
    review: 'Climate Review',
    invitedBy: 'Alice',
    createdAt: '2024-01-01',
  },
];

describe('Components - ReceivedInvitationsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAcceptInvitation.mockReturnValue(noopMutation as any);
    mockUseDeclineInvitation.mockReturnValue(noopMutation as any);
    mockUseDeleteInvitation.mockReturnValue(noopMutation as any);
  });

  it('should render the review title in the table', () => {
    render(<ReceivedInvitationsTable data={mockReceivedInvitations as any} />);
    expect(screen.getByText('Climate Review')).toBeInTheDocument();
  });

  it('should call acceptInvitation.mutate when accept button is clicked', async () => {
    const mutate = vi.fn();
    mockUseAcceptInvitation.mockReturnValue({ ...noopMutation, mutate } as any);

    render(<ReceivedInvitationsTable data={mockReceivedInvitations as any} />);
    // Accept button renders "Accept" text
    const acceptBtn = screen.getByRole('button', { name: /Accept/i });
    await userEvent.click(acceptBtn);
    expect(mutate).toHaveBeenCalledWith(1);
  });

  it('should call declineInvitation.mutate when decline button is clicked', async () => {
    const mutate = vi.fn();
    mockUseDeclineInvitation.mockReturnValue({
      ...noopMutation,
      mutate,
    } as any);

    render(<ReceivedInvitationsTable data={mockReceivedInvitations as any} />);
    const declineBtn = screen.getByRole('button', { name: /Decline/i });
    await userEvent.click(declineBtn);
    expect(mutate).toHaveBeenCalledWith(1);
  });
});

describe('Components - SentInvitationsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDeleteInvitation.mockReturnValue(noopMutation as any);
    mockUseAcceptInvitation.mockReturnValue(noopMutation as any);
    mockUseDeclineInvitation.mockReturnValue(noopMutation as any);
  });

  it('should render the invitee email in the table', () => {
    render(<SentInvitationsTable data={mockSentInvitations as any} />);
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('should show delete confirmation when trash button is clicked', async () => {
    render(<SentInvitationsTable data={mockSentInvitations as any} />);
    // The delete button renders "Delete" text
    const deleteBtn = screen.getAllByRole('button', { name: /Delete/i })[0];
    await userEvent.click(deleteBtn);
    // Actual dialog title: "Delete invitation?"
    expect(screen.getByText('Delete invitation?')).toBeInTheDocument();
  });

  it('should call deleteInvitation.mutate when deletion is confirmed', async () => {
    const mutate = vi.fn();
    mockUseDeleteInvitation.mockReturnValue({ ...noopMutation, mutate } as any);

    render(<SentInvitationsTable data={mockSentInvitations as any} />);
    // Open confirmation dialog
    const deleteBtn = screen.getAllByRole('button', { name: /Delete/i })[0];
    await userEvent.click(deleteBtn);
    // Confirm: there are now two "Delete" buttons — the action button in the dialog
    const allDeleteBtns = screen.getAllByRole('button', { name: /Delete/i });
    // The last one is the confirm action button inside AlertDialog
    await userEvent.click(allDeleteBtns[allDeleteBtns.length - 1]);
    expect(mutate).toHaveBeenCalledWith(2);
  });
});
