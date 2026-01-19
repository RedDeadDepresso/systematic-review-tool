export interface Note {
  id: number;
  content: string;
  dateCreated: string;
  dateEdited?: string;
  author?: {
    id: number;
    name: string;
    avatarUrl?: string;
  };
  referenceId: number;
  reviewId: number;
}
