import type { ReviewMember } from './review';

export interface Note {
  id: number;
  content: string;
  createdAt: Date;
  editedAt?: Date;
  member: ReviewMember;
  referenceId: number;
  reviewId: number;
}
