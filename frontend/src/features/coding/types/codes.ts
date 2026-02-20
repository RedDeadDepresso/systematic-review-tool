import { type Highlight, type Content } from 'react-pdf-highlighter-plus';

export interface Code extends Highlight {
  name: string;
  review: number;
  reference?: number;
  subTheme?: number | null;
  referenceFileUrl?: string;
  content: Content;
  comment?: string;

  // Text/Area highlight style properties
  highlightColor?: string;
  highlightStyle?: 'highlight' | 'underline' | 'strikethrough';
}

export type CommentedHighlight = Code;
