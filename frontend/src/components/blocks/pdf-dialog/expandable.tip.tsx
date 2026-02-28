import { useLayoutEffect, useState } from 'react';
import CommentForm from '@/components/blocks/pdf-dialog/comment-form';
import {
  type GhostHighlight,
  type PdfSelection,
  usePdfHighlighterContext,
} from 'react-pdf-highlighter-plus';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface ExpandableTipProps {
  addHighlight: (
    highlight: GhostHighlight,
    name: string,
    comment: string
  ) => void;
}

const ExpandableTip = ({ addHighlight }: ExpandableTipProps) => {
  const [compact, setCompact] = useState(true);
  const [selection, setSelection] = useState<PdfSelection | null>(null);

  const {
    getCurrentSelection,
    removeGhostHighlight,
    setTip,
    updateTipPosition,
  } = usePdfHighlighterContext();

  useLayoutEffect(() => {
    updateTipPosition!();
  }, [compact]);

  const handleAddClick = () => {
    const sel = getCurrentSelection();
    if (!sel) return;
    sel.makeGhostHighlight();
    setSelection(sel);
    setCompact(false);
  };

  const handleSubmit = (name: string, comment: string) => {
    if (!selection) return;

    addHighlight(
      {
        content: selection.content,
        type: selection.type,
        position: selection.position,
      },
      name,
      comment
    );

    removeGhostHighlight();
    setTip(null);
    setSelection(null);
    setCompact(true);
  };

  return (
    <div className="rounded-lg border bg-popover p-1 shadow-lg">
      {compact ? (
        <Button size="sm" onClick={handleAddClick}>
          <Plus className="mr-1 h-4 w-4" />
          Add code
        </Button>
      ) : (
        <CommentForm
          placeHolderName="Add a name"
          placeHolderComment="Your comment..."
          content={
            typeof selection?.content === 'string'
              ? undefined
              : selection?.content
          }
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
};

export default ExpandableTip;
