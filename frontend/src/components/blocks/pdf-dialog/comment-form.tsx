// Form for adding or editing a comment on a PDF highlight.
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import type { Content } from 'react-pdf-highlighter-plus';

interface CommentFormProps {
  onSubmit: (name: string, comment: string) => void;
  placeHolderName?: string;
  placeHolderComment?: string;
  content?: Content;
}

export default function CommentForm({
  onSubmit,
  placeHolderName,
  placeHolderComment,
  content,
}: CommentFormProps) {
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [sameAsContent, setSameAsContent] = useState(false);

  useEffect(() => {
    if (!content || !content?.text) return;
    if (sameAsContent) {
      setName(content.text);
    } else {
      setName('');
    }
  }, [sameAsContent, content]);

  const isValid = name.trim().length > 0;

  return (
    <div className="bg-background border rounded-xl shadow-md p-3 inline-block min-w-[14rem] space-y-2">
      {/* Name input */}{' '}
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(name, comment);
        }}
      >
        <Textarea
          placeholder={placeHolderName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="resize both min-h-[80px]"
        />

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={sameAsContent}
            onCheckedChange={(checked) => setSameAsContent(Boolean(checked))}
            disabled={!content || !content?.text}
          />
          Same as content
        </label>
        {/* Comment text */}
        <Textarea
          placeholder={placeHolderComment}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="resize both min-h-[80px]"
        />
        <Button size="sm" disabled={!isValid} className="w-full">
          Save
        </Button>
      </form>
    </div>
  );
}
