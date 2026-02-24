import type {
  Invitation,
  InvitationRole,
} from '@/features/reviews/types/invitations';
import api from '@/api/client';

/* ------------------ SEND INVITATIONS ------------------ */
export async function sendInvitations(payload: {
  review: number;
  emails: string[];
  role: InvitationRole;
}) {
  const res = await api.post('/review-invitations/', payload);
  return res.data;
}

/* ------------------ FETCH INVITATIONS ------------------ */
export async function fetchInvitations(
  type: 'received' | 'sent'
): Promise<Invitation[]> {
  const res = await api.get<Invitation[]>('/review-invitations/', {
    params: { type },
  });
  return res.data;
}

/* ------------------ ACCEPT INVITATION ------------------ */
export async function acceptInvitation(inviteId: number) {
  const res = await api.post<{ detail: string }>(
    `/review-invitations/${inviteId}/accept/`
  );
  return res.data;
}

/* ------------------ DECLINE INVITATION ------------------ */
export async function declineInvitation(inviteId: number) {
  const res = await api.post<{ detail: string }>(
    `/review-invitations/${inviteId}/decline/`
  );
  return res.data;
}

/* ------------------ DELETE INVITATION ------------------ */
/**
 * Only the sender (invited_by) may delete an invitation
 */
export async function deleteInvitation(inviteId: number) {
  const res = await api.delete(`/review-invitations/${inviteId}/`);
  return res.data;
}
