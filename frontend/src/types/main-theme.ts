import type { SubTheme } from './sub-theme';

export type MainTheme = {
  id: number;
  name: string;
  description: string;
  review: number;
  subThemes: SubTheme[];
};
