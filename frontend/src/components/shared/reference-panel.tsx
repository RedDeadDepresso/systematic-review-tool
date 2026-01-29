import React from 'react';
import { X, FileText, Tag, MessageSquare, Send, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Reference } from '@/types/reference';
import { ReferenceContent } from './reference-content';

interface ReferenceDetailPanelProps {
  reference: Reference | null;
  onClose: () => void;
  highlightIncludeKeywords?: string[];
  highlightExcludeKeywords?: string[];
  onAttachPDF?: () => void;
}

export function ReferenceDetailPanel({
  reference,
  onClose,
  highlightIncludeKeywords = [],
  highlightExcludeKeywords = [],
  onAttachPDF,
}: ReferenceDetailPanelProps) {
  const [noteText, setNoteText] = React.useState('');

  if (reference === null) {
    return (
      <div className="flex-1 border-l border-border bg-card flex flex-col shrink-0">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Select a reference to view details</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 border-l border-border bg-card flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-2 leading-relaxed">
            {reference.title}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ReferenceContent
        reference={reference}
        highlightIncludeKeywords={highlightIncludeKeywords}
        highlightExcludeKeywords={highlightExcludeKeywords}
      />

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-muted/30 space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2 bg-transparent"
            onClick={onAttachPDF}
          >
            <Paperclip className="h-4 w-4" />
            Attach PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2 text-primary border-primary bg-transparent"
          >
            <Tag className="h-4 w-4" />
            Label
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <Input
            placeholder="Add note"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="flex-1 h-8 text-sm"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 shrink-0"
            disabled={!noteText.trim()}
          >
            <Send
              className={cn(
                'h-4 w-4',
                noteText.trim() ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}
