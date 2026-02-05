import { type ReactNode } from 'react';

import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { highlightText } from '@/lib/reference';
import type { Reference } from '@/types/reference';
import {
  ExtractionFooter,
  ReviewDataFooter,
  ScreeningFooter,
  type ReviewDataFooterProps,
  type ScreeningFooterProps,
} from './references-table-footer';
import { ReferenceContent } from './reference-content';

interface ReferenceDrawerProps {
  reference: Reference;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  hasPrev: boolean;
  hasNext: boolean;
  highlightIncludeKeywords?: string[];
  highlightExcludeKeywords?: string[];
  children?: ReactNode;
}

export function ReferenceDrawer({
  reference,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
  highlightIncludeKeywords = [],
  highlightExcludeKeywords = [],
  children,
}: ReferenceDrawerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (reference !== null) {
      // Small delay for enter animation
      requestAnimationFrame(() => setIsVisible(true));
    }
  }, [reference]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  if (reference === null) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/30 z-40 transition-opacity duration-200',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 w-full max-w-2xl bg-card shadow-xl z-50 flex flex-col transition-transform duration-200',
          isVisible ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onNavigate('prev')}
            disabled={!hasPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0 px-2">
            <p className="text-sm font-medium truncate">
              {highlightText(
                reference.title,
                highlightIncludeKeywords,
                highlightExcludeKeywords
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onNavigate('next')}
            disabled={!hasNext}
          >
            <ChevronRight className="h-4 w-4" />
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
    </>
  );
}

export interface ReviewDataReferenceDrawerProps
  extends ReferenceDrawerProps,
    ReviewDataFooterProps {}

export function ReviewDataReferenceDrawer(
  props: ReviewDataReferenceDrawerProps
) {
  return (
    <ReferenceDrawer {...props} children={<ReviewDataFooter {...props} />} />
  );
}

export interface ScreeningeferenceDrawerProps
  extends ReferenceDrawerProps,
    ScreeningFooterProps {}

export function ScreeningReferenceDrawer(props: ScreeningeferenceDrawerProps) {
  return (
    <ReferenceDrawer {...props} children={<ScreeningFooter {...props} />} />
  );
}

export function ExtractionReferenceDrawer(
  props: ReviewDataReferenceDrawerProps
) {
  return (
    <ReferenceDrawer {...props} children={<ExtractionFooter {...props} />} />
  );
}
