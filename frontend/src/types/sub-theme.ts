import type { Code } from './code';

export type SubTheme = {
  id: number;
  name: string;
  description?: string;
  review: number;
  codes: Code[];
};
