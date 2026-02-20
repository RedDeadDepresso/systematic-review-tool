export type SubTheme = {
  id: number;
  name: string;
  description: string;
  review: number;
  codeIds: string[];
  mainTheme?: number | null;
};
