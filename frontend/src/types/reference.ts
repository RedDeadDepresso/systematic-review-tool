export type Opinion = {
  reviewer: string;
  status: 'Included' | 'Excluded' | 'Maybe';
};

export type Reference = {
  id: number;
  title: string;
  publication_types: string;
  authors: string;
  journal: string;
  search_methods: string;
  article_customizations: string;
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
  similarity_score: number;
};
