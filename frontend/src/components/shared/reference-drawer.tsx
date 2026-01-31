import React, { type ReactNode } from 'react';

import { useEffect, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  BookOpen,
  Users,
  Building,
  Hash,
  Link as LinkIcon,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { highlightText } from '@/lib/reference';
import type { Reference } from '@/types/reference';
import {
  ReviewDataFooter,
  ScreeningFooter,
  type ReviewDataFooterProps,
  type ScreeningFooterProps,
} from './references-table-footer';

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

function DetailSection({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4 border-b border-border last:border-b-0">
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground mb-1">{label}:</p>
          <div className="text-sm text-muted-foreground leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
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
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-0">
            <DetailSection icon={FileText} label="Abstract">
              {highlightText(
                reference.abstract,
                highlightIncludeKeywords,
                highlightExcludeKeywords
              )}
            </DetailSection>

            <DetailSection icon={BookOpen} label="Publication Types">
              {highlightText(
                reference.publicationType,
                highlightIncludeKeywords,
                highlightExcludeKeywords
              )}
            </DetailSection>

            <DetailSection icon={Users} label="Authors">
              {highlightText(
                reference.authors,
                highlightIncludeKeywords,
                highlightExcludeKeywords
              )}
            </DetailSection>

            <DetailSection icon={Building} label="Journal">
              {highlightText(
                reference.journal,
                highlightIncludeKeywords,
                highlightExcludeKeywords
              )}
              {reference.publicationDate &&
                ` - published ${reference.publicationDate}`}
            </DetailSection>

            <DetailSection icon={Hash} label="Reference ID">
              {reference.id}
            </DetailSection>

            {reference.url && (
              <DetailSection icon={LinkIcon} label="URL">
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {reference.url}
                </a>
              </DetailSection>
            )}

            {reference.doi && (
              <DetailSection icon={Hash} label="DOI">
                <a
                  href={`https://doi.org/${reference.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {reference.doi}
                </a>
              </DetailSection>
            )}

            <DetailSection icon={FolderOpen} label="Search Methods">
              Uploaded References [{reference.searchMethod}]
            </DetailSection>
          </div>
        </div>

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
