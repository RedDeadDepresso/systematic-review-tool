import type { Invitation, InvitationRole } from '@/types/invitation';
import api from './axios';

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
/**
 * sent = true  -> invitations sent by current user
 * sent = false -> invitations received by current user (default)
 */
export async function fetchInvitations(sent = false): Promise<Invitation[]> {
  const res = await api.get<Invitation[]>('/review-invitations/', {
    params: { sent },
  });
  return res.data;
}

/* ------------------ ACCEPT / DECLINE ------------------ */
export async function updateInvitationStatus(
  inviteId: number,
  action: 'accept' | 'decline'
) {
  const res = await api.put(`/review-invitations/${inviteId}/`, {
    action,
  });
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
