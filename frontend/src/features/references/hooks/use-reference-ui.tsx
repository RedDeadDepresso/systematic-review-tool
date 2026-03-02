import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Reference } from '@/features/references/types/references';
import type { ReferenceWithAnswers } from '@/features/extraction/types/extraction';
import { useWindowSize } from 'usehooks-ts';

type ReferenceType = Reference | ReferenceWithAnswers;

// ── Scroll helper ──────────────────────────────────────────────────────────────

/**
 * Scrolls the row with the given referenceId into view inside the scrollable
 * table container. Works for both the detail drawer and the PDF dialog.
 *
 * Uses [data-reference-id] attributes that must be placed on each row element.
 * The scroll container is found by walking up from the row to the first
 * overflow-y scrollable ancestor, so it works regardless of layout nesting.
 */
function scrollRowIntoView(referenceId: number) {
  // Defer to the next paint so the highlight state has been applied first.
  requestAnimationFrame(() => {
    const row = document.querySelector<HTMLElement>(
      `[data-reference-id="${referenceId}"]`
    );
    if (!row) return;

    // Find the nearest scrollable ancestor (the virtual/overflow table container).
    let container: HTMLElement | null = row.parentElement;
    while (container && container !== document.body) {
      const { overflowY } = window.getComputedStyle(container);
      if (overflowY === 'auto' || overflowY === 'scroll') break;
      container = container.parentElement;
    }

    if (!container || container === document.body) {
      // Fallback: plain scrollIntoView
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const rowRect = row.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const isAbove = rowRect.top < containerRect.top;
    const isBelow = rowRect.bottom > containerRect.bottom;

    if (isAbove || isBelow) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useReferenceUI<T extends ReferenceType>(
  references: T[],
  memberId?: number
) {
  // ── Sidebar collapse ──────────────────────────────────────────────────────
  const [isSourcesSidebarCollapsed, setIsSourcesSidebarCollapsed] =
    useState(true);
  const [isFiltersSidebarCollapsed, setIsFiltersSidebarCollapsed] =
    useState(true);

  // ── Selection ──────────────────────────────────────────────────────────────
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<number[]>(
    []
  );
  const [highlightedReferenceId, setHighlightedReferenceId] = useState<
    number | null
  >(null);

  // ── Drawer ─────────────────────────────────────────────────────────────────
  const [openDetailId, setOpenDetailId] = useState<number | null>(null);

  // ── PDF dialog ─────────────────────────────────────────────────────────────
  const [openPDFId, setOpenPDFId] = useState<number | null>(null);

  // ── Responsive sidebar ─────────────────────────────────────────────────────
  const { width } = useWindowSize();
  useEffect(() => {
    const isDesktop = width >= 1280;
    setIsSourcesSidebarCollapsed(!isDesktop);
    setIsFiltersSidebarCollapsed(!isDesktop);
  }, [width]);

  // ── Derived open items ─────────────────────────────────────────────────────
  const openDetail = useMemo(
    () =>
      openDetailId
        ? (references.find((r) => r.id === openDetailId) ?? null)
        : null,
    [openDetailId, references]
  );

  const openPDFReference = useMemo(
    () =>
      openPDFId ? (references.find((r) => r.id === openPDFId) ?? null) : null,
    [openPDFId, references]
  );

  const PDFOpinionStatus = useMemo(() => {
    if (!openPDFId || !memberId || !openPDFReference) return null;
    if (!('opinions' in openPDFReference)) return null;
    return (
      openPDFReference.opinions.find((o) => o.member.id === memberId)?.status ??
      null
    );
  }, [openPDFId, memberId, openPDFReference]);

  // ── Indexes ────────────────────────────────────────────────────────────────
  const currentDetailIndex =
    openDetailId !== null
      ? references.findIndex((r) => r.id === openDetailId)
      : -1;

  const currentPDFIndex =
    openPDFId !== null ? references.findIndex((r) => r.id === openPDFId) : -1;

  // ── PDF prev/next (skip references without a file) ────────────────────────
  const prevPDFReference = useMemo(() => {
    if (currentPDFIndex === -1) return null;
    for (let i = currentPDFIndex - 1; i >= 0; i--) {
      if (references[i].file) return references[i];
    }
    return null;
  }, [currentPDFIndex, references]);

  const nextPDFReference = useMemo(() => {
    if (currentPDFIndex === -1) return null;
    for (let i = currentPDFIndex + 1; i < references.length; i++) {
      if (references[i].file) return references[i];
    }
    return null;
  }, [currentPDFIndex, references]);

  const hasOpenPDFReferencePrev = prevPDFReference !== null;
  const hasOpenPDFReferenceNext = nextPDFReference !== null;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleReferenceSelect = useCallback((id: number) => {
    setSelectedReferenceIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }, []);

  const handleHighlightReference = useCallback((id: number | null) => {
    setHighlightedReferenceId(id);
  }, []);

  const handleSelectAllReferences = useCallback(() => {
    const allSelected = references.every((r) =>
      selectedReferenceIds.includes(r.id)
    );
    setSelectedReferenceIds(allSelected ? [] : references.map((r) => r.id));
  }, [references, selectedReferenceIds]);

  const handleOpenDetail = useCallback((id: number) => {
    setOpenDetailId(id);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setOpenDetailId(null);
  }, []);

  const handleOpenPDF = useCallback((id: number) => {
    setOpenPDFId(id);
  }, []);

  const handleClosePDF = useCallback(() => {
    setOpenPDFId(null);
  }, []);

  /**
   * Navigate the detail drawer to the prev/next reference.
   * Also scrolls the table row into view so the highlighted row
   * stays visible even when the list is long.
   */
  const handleNavigateDetail = useCallback(
    (direction: 'prev' | 'next') => {
      if (highlightedReferenceId === null) return;
      const currentIndex = references.findIndex(
        (r) => r.id === highlightedReferenceId
      );
      if (currentIndex === -1) return;

      const newIndex =
        direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= references.length) return;

      const newId = references[newIndex].id;
      setHighlightedReferenceId(newId);
      if (openDetailId !== null) setOpenDetailId(newId);

      scrollRowIntoView(newId);
    },
    [references, openDetailId, highlightedReferenceId]
  );

  /**
   * Navigate the PDF dialog to the prev/next reference that has a file.
   * Also scrolls the corresponding table row into view.
   */
  const handleOpenPDFNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      const target = direction === 'prev' ? prevPDFReference : nextPDFReference;
      if (!target) return;
      setOpenPDFId(target.id);
      scrollRowIntoView(target.id);
    },
    [prevPDFReference, nextPDFReference]
  );

  const total = references?.length ?? 0;
  const allSelected = total > 0 && selectedReferenceIds.length === total;

  return {
    // Sidebar
    isSourcesSidebarCollapsed,
    setIsSourcesSidebarCollapsed,
    isFiltersSidebarCollapsed,
    setIsFiltersSidebarCollapsed,

    // Selection
    selectedReferenceIds,
    highlightedReferenceId,
    handleReferenceSelect,
    handleHighlightReference,
    handleSelectAllReferences,
    allSelected,

    // References
    references,

    // Detail drawer
    openDetailId,
    openDetail,
    currentDetailIndex,
    handleOpenDetail,
    handleCloseDetail,
    handleNavigateDetail,

    // PDF dialog
    openPDFId,
    openPDFReference,
    PDFOpinionStatus,
    currentPDFIndex,
    hasOpenPDFReferencePrev,
    hasOpenPDFReferenceNext,
    handleOpenPDF,
    handleClosePDF,
    handleOpenPDFNavigate,
  };
}
