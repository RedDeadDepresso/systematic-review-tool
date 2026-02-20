import { type ReactNode } from 'react';
import { X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Reference } from '@/features/references/types/references';
import { ReferenceContent } from '@/features/references/components/references/reference-content';
import {
  ReviewDataFooter,
  ScreeningFooter,
  type ReviewDataFooterProps,
  type ScreeningFooterProps,
} from '@/features/references/components/references/references-table-footer';

interface ReferenceDetailPanelProps {
  reference: Reference | null;
  onClose: () => void;
  highlightIncludeKeywords?: string[];
  highlightExcludeKeywords?: string[];
  children?: ReactNode;
}

export function ReferenceDetailPanel({
  reference,
  onClose,
  highlightIncludeKeywords = [],
  highlightExcludeKeywords = [],
  children,
}: ReferenceDetailPanelProps) {
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
        showNotes={true}
      />

      {/* Footer */}
      {children}
    </div>
  );
}

interface ReviewDataReferenceDetailPanelProps
  extends ReferenceDetailPanelProps, ReviewDataFooterProps {}

export function ReviewDataReferenceDetailPanel(
  props: ReviewDataReferenceDetailPanelProps
) {
  return (
    <ReferenceDetailPanel
      {...props}
      children={<ReviewDataFooter {...props} />}
    />
  );
}

interface ScreeningReferenceDetailPanelProps
  extends ReferenceDetailPanelProps, ScreeningFooterProps {}

export function ScreeningReferenceDetailPanel(
  props: ScreeningReferenceDetailPanelProps
) {
  return (
    <ReferenceDetailPanel
      {...props}
      children={<ScreeningFooter {...props} />}
    />
  );
}
