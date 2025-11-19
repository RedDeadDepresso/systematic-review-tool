export interface Note {
  id: number;
  content: string;
  date_created: string;
  date_edited?: string;
  author?: {
    id: number;
    name: string;
    avatarUrl?: string;
  };
  referenceId: number;
  reviewId: number;
}
