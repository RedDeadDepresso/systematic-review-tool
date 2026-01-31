import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Reference, SortDirection, SortField } from '@/types/reference';

export function useReferenceUI(references: Reference[]) {
  // Sidebar collapse states
  const [isSourcesSidebarCollapsed, setIsSourcesSidebarCollapsed] =
    useState(true);
  const [isFiltersSidebarCollapsed, setIsFiltersSidebarCollapsed] =
    useState(true);

  // Selection state
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<number[]>(
    []
  );
  const [highlightedReferenceId, setHighlightedReferenceId] = useState<
    number | null
  >(null);

  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Drawer state
  const [openDetailId, setOpenDetailId] = useState<number | null>(null);

  // Auto-collapse sidebars on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSourcesSidebarCollapsed(true);
        setIsFiltersSidebarCollapsed(true);
      } else if (window.innerWidth >= 1024) {
        setIsSourcesSidebarCollapsed(false);
        setIsFiltersSidebarCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sorted references
  const sortedReferences = useMemo(() => {
    if (!sortField) return references;

    const refs = [...references];
    refs.sort((a, b) => {
      let aVal: string;
      let bVal: string;

      switch (sortField) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'date':
          aVal = a.publicationDate || '';
          bVal = b.publicationDate || '';
          break;
        case 'author':
          aVal = a.authors.toLowerCase();
          bVal = b.authors.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return refs;
  }, [references, sortField, sortDirection]);

  // Open detail reference
  const openDetail = useMemo(() => {
    if (!openDetailId) return null;
    return references.find((r) => r.id === openDetailId) ?? null;
  }, [openDetailId, references]);

  // Handlers
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

  const handleSortChange = useCallback(
    (field: SortField, direction: SortDirection) => {
      setSortField(field);
      setSortDirection(direction);
    },
    []
  );

  const handleOpenDetail = useCallback((id: number) => {
    setOpenDetailId(id);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setOpenDetailId(null);
  }, []);

  const handleNavigateDetail = useCallback(
    (direction: 'prev' | 'next') => {
      if (openDetailId === null) return;
      const currentIndex = sortedReferences.findIndex(
        (r) => r.id === openDetailId
      );
      if (currentIndex === -1) return;

      const newIndex =
        direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex >= 0 && newIndex < sortedReferences.length) {
        setOpenDetailId(sortedReferences[newIndex].id);
      }
    },
    [sortedReferences, openDetailId]
  );

  const currentDetailIndex =
    openDetailId !== null
      ? sortedReferences.findIndex((r) => r.id === openDetailId)
      : -1;

  const total = references?.length ?? 0;
  const allSelected = total > 0 && selectedReferenceIds.length === total;

  return {
    // Sidebar state
    isSourcesSidebarCollapsed,
    setIsSourcesSidebarCollapsed,
    isFiltersSidebarCollapsed,
    setIsFiltersSidebarCollapsed,

    // Selection state
    selectedReferenceIds,
    highlightedReferenceId,
    handleReferenceSelect,
    handleHighlightReference,
    handleSelectAllReferences,
    allSelected,

    // Sorting state
    sortField,
    sortDirection,
    sortedReferences,
    handleSortChange,

    // Detail drawer state
    openDetailId,
    openDetail,
    currentDetailIndex,
    handleOpenDetail,
    handleCloseDetail,
    handleNavigateDetail,
  };
}
