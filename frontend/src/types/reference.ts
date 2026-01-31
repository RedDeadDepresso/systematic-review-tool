import type { User } from './auth';

export type OpinionStatus = 'Undecided' | 'Included' | 'Excluded' | 'Maybe';

export type Opinion = {
  reviewer: User;
  status: OpinionStatus;
};

export type Label = {
  id: number;
  name: string;
  color?: string;
  hotkey?: string;
};

export type Reference = {
  id: number;
  title: string;
  publicationType: string;
  publicationDate: string;
  authors: string;
  journal: string;
  searchMethod: string;
  articleCustomizations: string;
  abstract: string;
  opinions: Opinion[];
  labels: Label[];
  file?: string;
  doi?: string;
  url?: string;
  assignee: User | null;
};

// Reference Table
export type SortField = 'title' | 'date' | 'author';
export type SortDirection = 'asc' | 'desc';
export type ArticleViewLayout = 'title-only' | 'title-abstract';

export type DuplicateReferencePair = {
  reference1: Reference;
  reference2: Reference;
  similarityScore: number;
};

export type ReferencePDFMapping = {
  referenceId: number;
  uploadedPdfId: number;
};
