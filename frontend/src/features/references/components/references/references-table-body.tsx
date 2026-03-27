// Table body: maps references to row components based on the active view layout.
import React, { useRef, useEffect, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  ArticleViewLayout,
  Reference,
} from '@/features/references/types/references';
import {
  ReferenceRowTitleAbstract,
  ReferenceRowTitleFile,
  ReferenceRowTitleOnly,
} from '@/features/references/components/references/references-table-row';
import { Loader2 } from 'lucide-react';

function SkeletonRowTitleOnly() {
  return (
    <div className="flex items-start px-3 sm:px-6 py-3 sm:py-4 border-b border-border">
      <div className="w-10 pt-1">
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <div className="w-6 sm:w-10 pt-1">
        <Skeleton className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2 mt-1">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="hidden sm:block w-28 pt-1">
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="hidden md:block w-32 pt-1">
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

function SkeletonRowTitleAbstract() {
  return (
    <div className="border-b border-border p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-4 w-4 rounded mt-1 shrink-0" />
        <div className="flex-1 flex gap-2">
          <Skeleton className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-32" />
            <div className="flex gap-2 mt-1">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-18 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonRowTitleFile() {
  return (
    <div className="flex items-start px-3 sm:px-6 py-3 sm:py-4 border-b border-border">
      <div className="w-10 pt-1">
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <div className="w-6 sm:w-10 pt-1">
        <Skeleton className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2 mt-1">
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
      <div className="hidden sm:block w-28 pt-1">
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="hidden md:block w-32 pt-1">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="w-28 pt-1">
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
      <div className="w-48 flex gap-1 pt-1 justify-end">
        <Skeleton className="h-8 w-14 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  );
}

const SKELETON_COUNT = 8;

const skeletonMap: Record<
  NonNullable<ArticleViewLayout>,
  React.ComponentType
> = {
  'title-only': SkeletonRowTitleOnly,
  'title-abstract': SkeletonRowTitleAbstract,
  'title-file': SkeletonRowTitleFile,
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface ReferenceTableBodyProps {
  references: Reference[];
  selectedReferenceIds: number[];
  highlightedReferenceId: number | null;
  onSelectReference: (id: number) => void;
  onHighlightReference: (id: number | null) => void;
  highlightIncludeKeywords?: string[];
  highlightExcludeKeywords?: string[];
  onOpenDetail: (id: number) => void;
  onOpenPDF: (referenceId: number) => void;
  onAttachPDF: () => void;
  viewLayout?: ArticleViewLayout;
  isLoading?: boolean;
  /** True while fetching additional pages (not the initial load) */
  isFetchingNextPage?: boolean;
  /** Whether more pages are available */
  hasNextPage?: boolean;
  /** Callback fired when the user scrolls near the bottom */
  onLoadMore?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReferencesTableBody({
  references,
  selectedReferenceIds,
  highlightedReferenceId,
  onSelectReference,
  highlightIncludeKeywords = [],
  highlightExcludeKeywords = [],
  onHighlightReference,
  onOpenDetail,
  viewLayout = 'title-only',
  onOpenPDF,
  onAttachPDF,
  isLoading = false,
  isFetchingNextPage = false,
  hasNextPage = false,
  onLoadMore,
}: ReferenceTableBodyProps) {
  // ── Infinite scroll sentinel ───────────────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        onLoadMore?.();
      }
    },
    [hasNextPage, isFetchingNextPage, onLoadMore]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, {
      // Fire when the sentinel is 200px away from the viewport bottom
      rootMargin: '0px 0px 200px 0px',
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  // ── Row interaction ────────────────────────────────────────────────────────

  const handleRowClick = (id: number, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-checkbox-area]')) return;
    onHighlightReference(highlightedReferenceId === id ? null : id);
  };

  const handleRowDoubleClick = (id: number, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-checkbox-area]')) return;
    onHighlightReference(id);
    onOpenDetail(id);
  };

  // ── Initial loading skeleton ───────────────────────────────────────────────

  if (isLoading) {
    const SkeletonRow = skeletonMap[viewLayout] ?? SkeletonRowTitleOnly;
    return (
      <div className="flex-1 overflow-y-auto">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (references.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No references found matching your filters.
      </div>
    );
  }

  // ── Row renderer ──────────────────────────────────────────────────────────

  const commonProps = (ref: Reference, index: number) => ({
    reference: ref,
    index,
    isSelected: selectedReferenceIds.includes(ref.id),
    isHighlighted: highlightedReferenceId === ref.id,
    onSelect: () => onSelectReference(ref.id),
    onClick: (e: React.MouseEvent) => handleRowClick(ref.id, e),
    onDoubleClick: (e: React.MouseEvent) => handleRowDoubleClick(ref.id, e),
    highlightIncludeKeywords,
    highlightExcludeKeywords,
    onOpenPDF,
    onAttachPDF,
  });

  const RowComponent =
    viewLayout === 'title-abstract'
      ? ReferenceRowTitleAbstract
      : viewLayout === 'title-file'
        ? ReferenceRowTitleFile
        : ReferenceRowTitleOnly;

  return (
    <div className="flex-1 overflow-y-auto">
      {references.map((ref, index) => (
        <RowComponent key={ref.id} {...commonProps(ref, index)} />
      ))}

      {/* Infinite scroll sentinel + next-page loading indicator */}
      <div ref={sentinelRef} className="py-4 flex items-center justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more…
          </div>
        )}
        {!hasNextPage && references.length > 0 && (
          <p className="text-xs text-muted-foreground">
            All {references.length} references loaded
          </p>
        )}
      </div>
    </div>
  );
}
