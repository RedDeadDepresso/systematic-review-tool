import { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

export function HighlightTip({
  onOpen,
  onConfirm,
  onCancel,
}: {
  onOpen: () => void;
  onConfirm: (comment: { text: string; emoji: string }) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');

  return (
    <div className="bg-background border rounded-xl shadow-md p-3 inline-block min-w-[14rem]">
      <Textarea
        placeholder="Add a note…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="resize both min-h-[80px]"
      />

      <div className="flex justify-end gap-2 mt-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onConfirm({ text, emoji: '🟨' })}>
          Save
        </Button>
      </div>
    </div>
  );
}
