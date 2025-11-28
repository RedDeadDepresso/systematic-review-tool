import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  return useMutation<
    Invitation,
    Error,
    { inviteId: number | string; action: 'accept' | 'decline' }
  >({
    mutationFn: ({ inviteId, action }) =>
      updateInvitationStatus(inviteId, action),
    onSuccess: (data, variables) => {
      toast.success('Invitation status updated.');
      queryClient.setQueryData<Invitation[]>(['invitations'], (oldData) => {
        if (!oldData) return [];

        // Remove the updated invitation from the list
        return oldData.filter((inv) => inv.id !== variables.inviteId);
      });
    },
  });
}
