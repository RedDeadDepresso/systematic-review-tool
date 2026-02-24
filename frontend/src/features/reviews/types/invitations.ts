export type InvitationRole = 'Reviewer' | 'Viewer';

export interface Invitation {
  id: number;
  review: string;
  email: string;
  invitedBy: string;
  createdAt: string;
  role: InvitationRole;
}
