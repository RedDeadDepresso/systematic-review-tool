import type { OpinionStatus } from '@/features/references/types/references';
import type { OrderingField } from '@/features/references/api/references';
import { useState, useCallback, useMemo } from 'react';
import { useDebounceValue } from 'usehooks-ts';

export interface ReferenceFilters {
  searchMethodIds: number[];
  includeKeywords: string[];
  excludeKeywords: string[];
  labelIds: number[];
  publicationTypes: string[];
  publicationYears: number[];
  hasFile?: boolean;
  assigneeIds: (number | null)[];
  duplicateStatuses: string[];
  opinionStatuses: OpinionStatus[];
  searchQuery: string;
  ordering: OrderingField;
  /** null = no filter, true = completed only, false = in-progress only */
  isExtractionCompleted: boolean | null;
}

export interface UseReferenceFiltersOptions {
  enableSearchMethods?: boolean;
  enableKeywords?: boolean;
  enableLabels?: boolean;
  enablePublicationFilters?: boolean;
  enableFileStatus?: boolean;
  enableAssignees?: boolean;
  enableDuplicates?: boolean;
  enableOpinions?: boolean;
  enableExtractionStatus?: boolean;
  debounceDelay?: number;
  defaultOrdering?: OrderingField;
}

export function useReferenceFilters(options: UseReferenceFiltersOptions = {}) {
  const ALL_OPINION_STATUSES: OpinionStatus[] = [
    'Undecided',
    'Included',
    'Maybe',
    'Excluded',
  ];

  const {
    enableSearchMethods = true,
    enableKeywords = true,
    enableLabels = true,
    enablePublicationFilters = true,
    enableFileStatus = true,
    enableAssignees = true,
    enableDuplicates = false,
    enableOpinions = false,
    enableExtractionStatus = false,
    debounceDelay = 500,
    defaultOrdering = 'title',
  } = options;

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [searchMethodIds, setSearchMethodIds] = useState<number[]>([]);
  const [includeKeywords, setIncludeKeywords] = useState<string[]>([]);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [labelIds, setLabelIds] = useState<number[]>([]);
  const [publicationTypes, setPublicationTypes] = useState<string[]>([]);
  const [publicationYears, setPublicationYears] = useState<number[]>([]);
  const [fileStatus, setFileStatus] = useState<
    'all' | 'withFile' | 'withoutFile'
  >('all');
  const [assigneeIds, setAssigneeIds] = useState<(number | null)[]>([]);
  const [duplicateStatuses, setDuplicateStatuses] = useState<string[]>([]);
  const [opinionStatuses, setOpinionStatuses] = useState<OpinionStatus[]>(
    enableOpinions ? ['Undecided'] : []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isExtractionCompleted, setIsExtractionCompleted] = useState<
    boolean | null
  >(false);

  // ── Ordering state — not debounced, applied immediately ───────────────────────
  const [ordering, setOrdering] = useState<OrderingField>(defaultOrdering);

  /**
   * Toggle sort field.
   * - First click on a new field → ascending
   * - Second click on same field → descending
   * - Third click → back to ascending (no "clear sort" to keep UX simple)
   */
  const handleOrderingChange = useCallback((field: any) => {
    setOrdering((prev) => {
      if (prev === field) return `-${field}` as OrderingField; // asc → desc
      if (prev === `-${field}`) return field as OrderingField; // desc → asc
      return field as OrderingField; // new field → asc
    });
  }, []);

  // ── Debounced filters (sent to API) ───────────────────────────────────────────
  const optimisticFilters: ReferenceFilters = useMemo(
    () => ({
      searchMethodIds,
      includeKeywords,
      excludeKeywords,
      labelIds,
      publicationTypes,
      publicationYears,
      hasFile: fileStatus === 'all' ? undefined : fileStatus === 'withFile',
      assigneeIds,
      duplicateStatuses,
      opinionStatuses,
      searchQuery,
      ordering,
      isExtractionCompleted,
    }),
    [
      searchMethodIds,
      includeKeywords,
      excludeKeywords,
      labelIds,
      publicationTypes,
      publicationYears,
      fileStatus,
      assigneeIds,
      duplicateStatuses,
      opinionStatuses,
      searchQuery,
      ordering,
      isExtractionCompleted,
    ]
  );

  const [debouncedFilters, isDebouncing] = useDebounceValue(
    optimisticFilters,
    debounceDelay
  );

  // ── Toggle handlers ────────────────────────────────────────────────────────────

  const handleSearchMethodToggle = useCallback(
    (id: number) => {
      if (!enableSearchMethods) return;
      setSearchMethodIds((prev) =>
        prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
      );
    },
    [enableSearchMethods]
  );

  const handleIncludeKeywordToggle = useCallback(
    (keyword: string) => {
      if (!enableKeywords) return;
      setIncludeKeywords((prev) =>
        prev.includes(keyword)
          ? prev.filter((k) => k !== keyword)
          : [...prev, keyword]
      );
    },
    [enableKeywords]
  );

  const handleExcludeKeywordToggle = useCallback(
    (keyword: string) => {
      if (!enableKeywords) return;
      setExcludeKeywords((prev) =>
        prev.includes(keyword)
          ? prev.filter((k) => k !== keyword)
          : [...prev, keyword]
      );
    },
    [enableKeywords]
  );

  const handleLabelToggle = useCallback(
    (labelId: number) => {
      if (!enableLabels) return;
      setLabelIds((prev) =>
        prev.includes(labelId)
          ? prev.filter((id) => id !== labelId)
          : [...prev, labelId]
      );
    },
    [enableLabels]
  );

  const handlePublicationTypeToggle = useCallback(
    (type: string) => {
      if (!enablePublicationFilters) return;
      setPublicationTypes((prev) =>
        prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
      );
    },
    [enablePublicationFilters]
  );

  const handlePublicationYearToggle = useCallback(
    (year: number) => {
      if (!enablePublicationFilters) return;
      setPublicationYears((prev) =>
        prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
      );
    },
    [enablePublicationFilters]
  );

  const handleFileStatusChange = useCallback(
    (s: 'all' | 'withFile' | 'withoutFile') => {
      if (!enableFileStatus) return;
      setFileStatus(s);
    },
    [enableFileStatus]
  );

  const handleAssigneeToggle = useCallback(
    (assigneeId: number | null) => {
      if (!enableAssignees) return;
      setAssigneeIds((prev) =>
        prev.includes(assigneeId)
          ? prev.filter((id) => id !== assigneeId)
          : [...prev, assigneeId]
      );
    },
    [enableAssignees]
  );

  const handleDuplicateStatusToggle = useCallback(
    (s: string) => {
      if (!enableDuplicates) return;
      setDuplicateStatuses((prev) =>
        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
      );
    },
    [enableDuplicates]
  );

  const handleOpinionStatusToggle = useCallback(
    (s: OpinionStatus) => {
      if (!enableOpinions) return;
      setOpinionStatuses((prev) =>
        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
      );
    },
    [enableOpinions]
  );

  // ── Select all handlers ────────────────────────────────────────────────────────

  const handleSelectAllIncludeKeywords = useCallback(
    (all: string[]) => {
      if (!enableKeywords) return;
      setIncludeKeywords((prev) => (prev.length === all.length ? [] : all));
    },
    [enableKeywords]
  );

  const handleSelectAllExcludeKeywords = useCallback(
    (all: string[]) => {
      if (!enableKeywords) return;
      setExcludeKeywords((prev) => (prev.length === all.length ? [] : all));
    },
    [enableKeywords]
  );

  const handleSelectAllLabels = useCallback(
    (all: number[]) => {
      if (!enableLabels) return;
      setLabelIds((prev) => (prev.length === all.length ? [] : all));
    },
    [enableLabels]
  );

  const handleSelectAllPublicationTypes = useCallback(
    (all: string[]) => {
      if (!enablePublicationFilters) return;
      setPublicationTypes((prev) => (prev.length === all.length ? [] : all));
    },
    [enablePublicationFilters]
  );

  const handleSelectAllPublicationYears = useCallback(
    (all: number[]) => {
      if (!enablePublicationFilters) return;
      setPublicationYears((prev) => (prev.length === all.length ? [] : all));
    },
    [enablePublicationFilters]
  );

  const handleSelectAllAssignees = useCallback(
    (all: (number | null)[]) => {
      if (!enableAssignees) return;
      setAssigneeIds((prev) => (prev.length === all.length ? [] : all));
    },
    [enableAssignees]
  );

  const handleSelectAllSearchMethods = useCallback(
    (all: number[]) => {
      if (!enableSearchMethods) return;
      setSearchMethodIds((prev) => (prev.length === all.length ? [] : all));
    },
    [enableSearchMethods]
  );

  const handleSelectAllOpinionStatuses = useCallback(
    (all: OpinionStatus[]) => {
      if (!enableOpinions) return;
      setOpinionStatuses((prev) => (prev.length === all.length ? [] : all));
    },
    [enableOpinions]
  );

  // ── Active filter count ────────────────────────────────────────────────────────

  const activeFilterCount =
    (enableSearchMethods ? searchMethodIds.length : 0) +
    (enableKeywords ? includeKeywords.length : 0) +
    (enableKeywords ? excludeKeywords.length : 0) +
    (enableLabels ? labelIds.length : 0) +
    (enablePublicationFilters ? publicationTypes.length : 0) +
    (enablePublicationFilters ? publicationYears.length : 0) +
    (fileStatus !== 'all' ? 1 : 0) +
    (enableAssignees ? assigneeIds.length : 0) +
    (enableExtractionStatus ? duplicateStatuses.length : 0) +
    (enableOpinions ? opinionStatuses.length : 0) +
    (searchQuery.trim() ? 1 : 0) +
    (enableExtractionStatus && isExtractionCompleted !== null ? 1 : 0);

  // ── Reset ──────────────────────────────────────────────────────────────────────

  const handleResetAllFilters = useCallback(() => {
    if (enableSearchMethods) setSearchMethodIds([]);
    if (enableKeywords) {
      setIncludeKeywords([]);
      setExcludeKeywords([]);
    }
    if (enableLabels) setLabelIds([]);
    if (enablePublicationFilters) {
      setPublicationTypes([]);
      setPublicationYears([]);
    }
    if (enableFileStatus) setFileStatus('all');
    if (enableAssignees) setAssigneeIds([]);
    if (enableDuplicates) setDuplicateStatuses([]);
    setSearchQuery('');
    if (enableOpinions) setOpinionStatuses([]);
    if (enableExtractionStatus) setIsExtractionCompleted(null);
    setOrdering(defaultOrdering);
  }, [
    enableSearchMethods,
    enableKeywords,
    enableLabels,
    enablePublicationFilters,
    enableFileStatus,
    enableAssignees,
    enableDuplicates,
    enableOpinions,
    enableExtractionStatus,
    defaultOrdering,
  ]);

  return {
    ALL_OPINION_STATUSES,

    // Optimistic UI state
    searchMethodIds,
    includeKeywords,
    excludeKeywords,
    labelIds,
    publicationTypes,
    publicationYears,
    fileStatus,
    assigneeIds,
    duplicateStatuses,
    searchQuery,
    opinionStatuses,
    ordering,
    isExtractionCompleted,
    setIsExtractionCompleted,

    // Debounced filters for API (includes ordering so offset resets on sort change)
    filters: debouncedFilters,

    // Setters
    setSearchQuery,
    setIncludeKeywords,
    setExcludeKeywords,
    setSearchMethodIds,

    // Ordering
    handleOrderingChange,

    // Toggle handlers
    handleSearchMethodToggle,
    handleIncludeKeywordToggle,
    handleExcludeKeywordToggle,
    handleLabelToggle,
    handlePublicationTypeToggle,
    handlePublicationYearToggle,
    handleFileStatusChange,
    handleAssigneeToggle,
    handleDuplicateStatusToggle,
    handleOpinionStatusToggle,

    // Select all
    handleSelectAllIncludeKeywords,
    handleSelectAllExcludeKeywords,
    handleSelectAllLabels,
    handleSelectAllPublicationTypes,
    handleSelectAllPublicationYears,
    handleSelectAllAssignees,
    handleSelectAllSearchMethods,
    handleSelectAllOpinionStatuses,

    // Reset
    handleResetAllFilters,

    // Utility
    activeFilterCount,
    isDebouncing,
  };
}
