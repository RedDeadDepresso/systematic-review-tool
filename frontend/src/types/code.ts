import type { IHighlight } from 'react-pdf-highlighter';

export interface Code extends IHighlight {
  reference: number;
  sub_theme?: number;
  color: string;
}
