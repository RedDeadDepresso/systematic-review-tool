import type { ViewportHighlight } from 'react-pdf-highlighter-plus';
import { type CommentedHighlight } from '@/types/code';

interface HighlightPopupProps {
  highlight: ViewportHighlight<CommentedHighlight>;
}

const HighlightPopup = ({ highlight }: HighlightPopupProps) => {
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      {highlight.comment || 'No comment'}
    </div>
  );
};

export default HighlightPopup;
