import type { IHighlight } from 'react-pdf-highlighter';

export interface Code extends IHighlight {
  reference: number;
}
