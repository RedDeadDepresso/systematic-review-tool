import type { User } from './auth';

export type ReviewRole = 'Owner' | 'Reviewer' | 'Viewer';

export type ReviewMember = {
  id: number;
  user: User;
  role: ReviewRole;
};

export type Review = {
  title: string;
  description: string;
  isActive: boolean;
  referenceCount: number;
  referenceDuplicatesCount: number;
  userRole: ReviewRole;
  members: ReviewMember[];
};

export type ReviewRow = {
  title: string;
  dateCreated: string;
  owner: string;
  referenceCount: number;
  id: number;
  userRole: ReviewRole;
};
