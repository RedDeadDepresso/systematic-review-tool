export type InvitationRole = 'collaborator' | 'reviewer' | 'viewer';

export interface Invitation {
  id: number;
  review: string;
  email: string;
  invitedBy: string;
  createdAt: string;
  role: InvitationRole;
}
