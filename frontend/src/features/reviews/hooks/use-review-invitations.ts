import { errorMessageString } from '@/lib/error';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  sendInvitations,
  fetchInvitations,
  acceptInvitation,
  declineInvitation,
  deleteInvitation,
} from '@/features/reviews/api/review-invitations';
import { toast } from 'sonner';
import type { Invitation } from '@/features/reviews/types/invitations';

// Send Invite Hook
export function useSendInvitations() {
  return useMutation({
    mutationFn: sendInvitations,
    onSuccess: () => toast.success('Invitations have been sent.'),
    onError: (error) =>
      toast.error(`Failed to send invitations: ${errorMessageString(error)}.`),
  });
}

// Fetch Invite Hook
export function useFetchInvitations(
  type: 'received' | 'sent',
  enabled: boolean
) {
  return useQuery<Invitation[], Error>({
    queryKey: ['invitations', type],
    queryFn: () => fetchInvitations(type),
    enabled: enabled,
  });
}

const deleteOnSuccess = (deleteId: number, oldData?: Invitation[]) => {
  if (!oldData) return [];
  return oldData.filter((inv) => inv.id !== deleteId);
};

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: (_, variables) => {
      toast.success('Successfully accepted invitation.');
      queryClient.setQueryData<Invitation[]>(
        ['invitations', 'received'],
        (oldData) => deleteOnSuccess(variables, oldData)
      );
      queryClient.invalidateQueries({
        queryKey: ['reviews', { isActive: true }],
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to accept invitation: ${errorMessageString(error)}.`);
    },
  });
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: declineInvitation,
    onSuccess: (_, variables) => {
      toast.success('Successfully declined Invitation.');
      queryClient.setQueryData<Invitation[]>(
        ['invitations', 'received'],
        (oldData) => deleteOnSuccess(variables, oldData)
      );
    },
    onError: (error: any) => {
      toast.error(
        `Failed to decline invitation: ${errorMessageString(error)}.`
      );
    },
  });
}

export const useDeleteInvitation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteInvitation,
    onSuccess: (_, variables) => {
      queryClient.setQueryData(
        ['invitations', 'sent'],
        (oldData: Invitation[]) => deleteOnSuccess(variables, oldData)
      );
      toast.success('Invitation deleted successfully.');
    },
    onError: (error: any) => {
      toast.error(
        `Failed to delete invitations: ${errorMessageString(error)}.`
      );
    },
  });
};
