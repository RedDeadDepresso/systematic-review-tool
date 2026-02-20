import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  sendInvitations,
  fetchInvitations,
  updateInvitationStatus,
} from '@/features/reviews/api/review-invitations';
import { toast } from 'sonner';
import type { Invitation } from '@/features/reviews/types/invitations';

// Send Invite Hook
export function useSendInvitations() {
  return useMutation({
    mutationFn: sendInvitations,
    onSuccess: () => toast.success('Invitations have been sent.'),
    onError: (error) =>
      toast.error(`Failed to send invitations: ${error.message}`),
  });
}

// Fetch Invite Hook
export function useFetchInvitations() {
  return useQuery<Invitation[], Error>({
    queryKey: ['invitations'],
    queryFn: () => fetchInvitations(),
  });
}

export function useUpdateInvitationStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    Invitation,
    Error,
    { inviteId: number; action: 'accept' | 'decline' }
  >({
    mutationFn: ({ inviteId, action }) =>
      updateInvitationStatus(inviteId, action),
    onSuccess: (_data, variables) => {
      toast.success('Invitation status updated.');
      queryClient.setQueryData<Invitation[]>(['invitations'], (oldData) => {
        if (!oldData) return [];

        // Remove the updated invitation from the list
        return oldData.filter((inv) => inv.id !== variables.inviteId);
      });
    },
  });
}
