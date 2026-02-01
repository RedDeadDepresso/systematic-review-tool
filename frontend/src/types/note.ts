import type { User } from './auth';

export interface Note {
  id: number;
  content: string;
  dateCreated: string;
  dateEdited?: string;
  author: User;
  referenceId: number;
  reviewId: number;
}
