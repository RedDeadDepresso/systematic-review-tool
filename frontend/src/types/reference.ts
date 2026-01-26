export type Opinion = {
  reviewer: string;
  status: 'Included' | 'Excluded' | 'Maybe';
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
  opinions?: Opinion[];
  file?: string;
};

export type ReferenceRow = {
  id: number;
  title: string;
  authors: string;
};

export type DuplicateReferencePair = {
  reference1: Reference;
  reference2: Reference;
  similarityScore: number;
};

export type ReferencePDFMapping = {
  referenceId: number;
  uploadedPdfId: number;
};

export type Label = {
  id: number;
  name: string;
  color?: string;
  hotkey?: string;
};
