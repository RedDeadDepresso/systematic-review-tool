export type Reference = {
  id: number;
  title: string;
  publication_types: string;
  authors: string;
  journal: string;
  search_methods: string;
  article_customizations: string;
  abstract: string;
  status: 'Undecided' | 'Excluded' | 'Maybe' | 'Included';
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
