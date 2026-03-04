import type { User } from '@/features/users/types/auth';

export type ReviewRole = 'owner' | 'collaborator' | 'reviewer' | 'viewer';

export type ReviewMember = {
  id: number;
  user: User;
  role: ReviewRole;
};

export type DuplicateDetectionStatus = 'Not Started' | 'Pending' | 'Completed';

export type Review = {
  title: string;
  description: string;
  isActive: boolean;
  referenceCount: number | null;
  userRole: ReviewRole;
  userMemberId: number;
  members: ReviewMember[];
  isBlinded: boolean;
  duplicateDetectionStatus: string;
  duplicateClustersCount: number | null;
  duplicateClustersUnresolvedCount: number | null;
  duplicateResolvedCount: number;
  duplicateNotDuplicateCount: number;
  duplicateDeletedCount: number;
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

export interface PrismaData {
  dbRegisters: DbRegisters;
  included: Included;
}

export interface DbRegisters {
  identification: {
    databases: number;
    registers?: number;
  };
  removedBeforeScreening?: {
    duplicates?: number;
    automation?: number;
    other?: number;
  };
  records?: {
    screened?: number;
    excluded?: number;
  };
  reports?: {
    sought?: number;
    notRetrieved?: number;
    assessed?: number;
    excludedReasons?: Record<string, number>; // e.g., { 'wrong popululation': 4, 'wrong setting': 2 }
  };
}

export interface Included {
  studies: number;
  reports?: number; // if missing, assume equal to studies
}

export interface ValidationIssue {
  severity: string; // e.g., "WARNING", "ERROR", "INFO"
  message: string;
}
