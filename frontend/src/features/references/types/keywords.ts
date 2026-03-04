export type KeywordType = 'inclusion' | 'exclusion';

export type Keyword = {
  id: number;
  name: string;
  type: KeywordType;
};
