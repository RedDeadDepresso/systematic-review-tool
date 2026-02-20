import type { ReviewMember } from '../../reviews/types/reviews';

export interface Note {
  id: number;
  content: string;
  createdAt: Date;
  editedAt?: Date;
  member: ReviewMember;
  referenceId: number;
  reviewId: number;
}
