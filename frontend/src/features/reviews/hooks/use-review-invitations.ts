import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  sendInvitations,
  fetchInvitations,
  acceptInvitation,
  declineInvitation,
  deleteInvitation,
} from '@/features/reviews/api/review-invitations';
import type { Invitation } from '@/features/reviews/types/invitations';
import { cacheRemove, onMutationError } from '@/lib/query-helpers';
import { reviewKeys } from '@/features/reviews/hooks/use-reviews';

export const invitationKeys = {
  list: (type: 'received' | 'sent') => ['invitations', type] as const,
};

export function useSendInvitations() {
  return useMutation({
    mutationFn: sendInvitations,
    onSuccess: () => toast.success('Invitations have been sent.'),
    onError: onMutationError('send invitations'),
  });
}

export function useFetchInvitations(
  type: 'received' | 'sent',
  enabled: boolean
) {
  return useQuery<Invitation[], Error>({
    queryKey: invitationKeys.list(type),
    queryFn: () => fetchInvitations(type),
    enabled,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: (_, id) => {
      toast.success('Successfully accepted invitation.');
      queryClient.setQueryData<Invitation[]>(
        invitationKeys.list('received'),
        cacheRemove(id)
      );
      queryClient.invalidateQueries({
        queryKey: reviewKeys.list({ isActive: true }),
      });
    },
    onError: onMutationError('accept invitation'),
  });
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: declineInvitation,
    onSuccess: (_, id) => {
      toast.success('Successfully declined Invitation.');
      queryClient.setQueryData<Invitation[]>(
        invitationKeys.list('received'),
        cacheRemove(id)
      );
    },
    onError: onMutationError('decline invitation'),
  });
}

export const useDeleteInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteInvitation,
    onSuccess: (_, id) => {
      queryClient.setQueryData<Invitation[]>(
        invitationKeys.list('sent'),
        cacheRemove(id)
      );
      toast.success('Invitation deleted successfully.');
    },
    onError: onMutationError('delete invitation'),
  });
};
