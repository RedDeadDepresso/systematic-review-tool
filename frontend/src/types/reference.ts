export type Opinion = {
  reviewer: string;
  status: 'Included' | 'Excluded' | 'Maybe';
};

export type Reference = {
  id: number;
  title: string;
  publicationTypes: string;
  authors: string;
  journal: string;
  searchMethods: string;
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
