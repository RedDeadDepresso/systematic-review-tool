import type { Code } from './code';

export type Theme = {
  id: number;
  name: string;
  description?: string;
  review: number;
  codes: Code[];
};
