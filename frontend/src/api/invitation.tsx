import api from './axios';

export async function sendInvites(reviewId: number | string, emails: string[]) {
  const res = await api.post(`reviews/${reviewId}/invites/`, { emails });
  return res.data;
}

export async function fetchInvites() {
  const res = await api.get(`invites/`);
  return res.data;
}

export async function updateInvitationStatus(
  inviteId: number | string,
  action: 'accept' | 'decline'
) {
  const res = await api.post(`invites/${inviteId}/`, { action: action });
  return res.data;
}
