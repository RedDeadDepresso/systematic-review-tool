import { useMutation, useQuery } from '@tanstack/react-query';
import {
  sendInvites,
  fetchInvites,
  updateInvitationStatus,
} from '@/api/invitation';
import { toast } from 'sonner';
import type { Invitation } from '@/types/invitation';

// Send Invite Hook
export function useSendInvitations(reviewId: number | string) {
  return useMutation<Invitation, Error, string[]>({
    mutationFn: (emails) => sendInvites(reviewId, emails),
    onSuccess: () => toast.success('Invitations have been sent.'),
    onError: (error) =>
      toast.error(`Failed to send invitations: ${error.message}`),
  });
}

// Fetch Invite Hook
export function useFetchInvitations() {
  return useQuery<Invitation[], Error>({
    queryKey: ['invitations'],
    queryFn: fetchInvites,
  });
}

export function useUpdateInvitationStatus() {
  return useMutation<
    Invitation,
    Error,
    { inviteId: number | string; action: 'accept' | 'decline' }
  >({
    mutationFn: ({ inviteId, action }) =>
      updateInvitationStatus(inviteId, action),
    onSuccess: () => toast.success('Invitation status updated.'),
    onError: (error) =>
      toast.error(`Failed to update invitation status: ${error.message}`),
  });
}
