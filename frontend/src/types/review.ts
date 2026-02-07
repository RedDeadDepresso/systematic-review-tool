import type { User } from './auth';

export type ReviewRole = 'Owner' | 'Collaborator' | 'Reviewer' | 'Viewer';

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
  isBlinded: boolean;
};

export type ReviewRow = {
  title: string;
  dateCreated: string;
  owner: string;
  referenceCount: number;
  id: number;
  userRole: ReviewRole;
};

type LabelCount = {
  id: number;
  name: string;
  color: string;
  count: number;
};

export type ArticleCounts = {
  included: number;
  maybe: number;
  labeleled: number;
  labels: LabelCount[];
};
