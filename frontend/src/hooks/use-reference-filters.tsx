import { useState, useCallback, useEffect, useRef } from 'react';

export interface ReviewDataFilters {
  searchMethodIds: number[];
  includeKeywords: string[];
  excludeKeywords: string[];
  labelIds: number[];
  publicationTypes: string[];
  publicationYears: number[];
  fileStatus: 'all' | 'withFile' | 'withoutFile';
  assigneeIds: (number | null)[];
  duplicateStatuses: string[];
  searchQuery: string;
}

export interface UseReviewDataFiltersOptions {
  enableSearchMethods?: boolean;
  enableKeywords?: boolean;
  enableLabels?: boolean;
  enablePublicationFilters?: boolean;
  enableFileStatus?: boolean;
  enableAssignees?: boolean;
  enableDuplicates?: boolean;
  debounceDelay?: number;
}

export function useReviewDataFilters(
  options: UseReviewDataFiltersOptions = {}
) {
  const {
    enableSearchMethods = true,
    enableKeywords = true,
    enableLabels = true,
    enablePublicationFilters = true,
    enableFileStatus = true,
    enableAssignees = true,
    enableDuplicates = true,
    debounceDelay = 500, // Default 500ms debounce
  } = options;

  // Optimistic state (updates immediately for UI)
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
  const [searchQuery, setSearchQuery] = useState('');

  // Debounced state (for API calls)
  const [debouncedSearchMethodIds, setDebouncedSearchMethodIds] = useState<
    number[]
  >([]);
  const [debouncedIncludeKeywords, setDebouncedIncludeKeywords] = useState<
    string[]
  >([]);
  const [debouncedExcludeKeywords, setDebouncedExcludeKeywords] = useState<
    string[]
  >([]);
  const [debouncedLabelIds, setDebouncedLabelIds] = useState<number[]>([]);
  const [debouncedPublicationTypes, setDebouncedPublicationTypes] = useState<
    string[]
  >([]);
  const [debouncedPublicationYears, setDebouncedPublicationYears] = useState<
    number[]
  >([]);
  const [debouncedFileStatus, setDebouncedFileStatus] = useState<
    'all' | 'withFile' | 'withoutFile'
  >('all');
  const [debouncedAssigneeIds, setDebouncedAssigneeIds] = useState<
    (number | null)[]
  >([]);
  const [debouncedDuplicateStatuses, setDebouncedDuplicateStatuses] = useState<
    string[]
  >([]);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce logic
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedSearchMethodIds(searchMethodIds);
      setDebouncedIncludeKeywords(includeKeywords);
      setDebouncedExcludeKeywords(excludeKeywords);
      setDebouncedLabelIds(labelIds);
      setDebouncedPublicationTypes(publicationTypes);
      setDebouncedPublicationYears(publicationYears);
      setDebouncedFileStatus(fileStatus);
      setDebouncedAssigneeIds(assigneeIds);
      setDebouncedDuplicateStatuses(duplicateStatuses);
      setDebouncedSearchQuery(searchQuery);
    }, debounceDelay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
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
    debounceDelay,
  ]);

  // Toggle handlers (update optimistic state immediately)
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
    (status: 'all' | 'withFile' | 'withoutFile') => {
      if (!enableFileStatus) return;
      setFileStatus(status);
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
    (status: string) => {
      if (!enableDuplicates) return;
      setDuplicateStatuses((prev) =>
        prev.includes(status)
          ? prev.filter((s) => s !== status)
          : [...prev, status]
      );
    },
    [enableDuplicates]
  );

  // Select all handlers
  const handleSelectAllIncludeKeywords = useCallback(
    (allKeywords: string[]) => {
      if (!enableKeywords) return;
      setIncludeKeywords((prev) =>
        prev.length === allKeywords.length ? [] : allKeywords
      );
    },
    [enableKeywords]
  );

  const handleSelectAllExcludeKeywords = useCallback(
    (allKeywords: string[]) => {
      if (!enableKeywords) return;
      setExcludeKeywords((prev) =>
        prev.length === allKeywords.length ? [] : allKeywords
      );
    },
    [enableKeywords]
  );

  const handleSelectAllLabels = useCallback(
    (allLabelIds: number[]) => {
      if (!enableLabels) return;
      setLabelIds((prev) =>
        prev.length === allLabelIds.length ? [] : allLabelIds
      );
    },
    [enableLabels]
  );

  const handleSelectAllPublicationTypes = useCallback(
    (allTypes: string[]) => {
      if (!enablePublicationFilters) return;
      setPublicationTypes((prev) =>
        prev.length === allTypes.length ? [] : allTypes
      );
    },
    [enablePublicationFilters]
  );

  const handleSelectAllPublicationYears = useCallback(
    (allYears: number[]) => {
      if (!enablePublicationFilters) return;
      setPublicationYears((prev) =>
        prev.length === allYears.length ? [] : allYears
      );
    },
    [enablePublicationFilters]
  );

  const handleSelectAllAssignees = useCallback(
    (allAssigneeIds: (number | null)[]) => {
      if (!enableAssignees) return;
      setAssigneeIds((prev) =>
        prev.length === allAssigneeIds.length ? [] : allAssigneeIds
      );
    },
    [enableAssignees]
  );

  const handleSelectAllSearchMethods = useCallback(
    (allMethodIds: number[]) => {
      if (!enableSearchMethods) return;
      setSearchMethodIds((prev) =>
        prev.length === allMethodIds.length ? [] : allMethodIds
      );
    },
    [enableSearchMethods]
  );

  // Reset all filters
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
  }, [
    enableSearchMethods,
    enableKeywords,
    enableLabels,
    enablePublicationFilters,
    enableFileStatus,
    enableAssignees,
    enableDuplicates,
  ]);

  // Get active filters for API (using debounced values)
  const getActiveFilters = useCallback((): Partial<ReviewDataFilters> => {
    const filters: Partial<ReviewDataFilters> = {
      searchQuery: debouncedSearchQuery,
    };

    if (enableSearchMethods) filters.searchMethodIds = debouncedSearchMethodIds;
    if (enableKeywords) {
      filters.includeKeywords = debouncedIncludeKeywords;
      filters.excludeKeywords = debouncedExcludeKeywords;
    }
    if (enableLabels) filters.labelIds = debouncedLabelIds;
    if (enablePublicationFilters) {
      filters.publicationTypes = debouncedPublicationTypes;
      filters.publicationYears = debouncedPublicationYears;
    }
    if (enableFileStatus) filters.fileStatus = debouncedFileStatus;
    if (enableAssignees) filters.assigneeIds = debouncedAssigneeIds;
    if (enableDuplicates)
      filters.duplicateStatuses = debouncedDuplicateStatuses;

    return filters;
  }, [
    debouncedSearchMethodIds,
    debouncedIncludeKeywords,
    debouncedExcludeKeywords,
    debouncedLabelIds,
    debouncedPublicationTypes,
    debouncedPublicationYears,
    debouncedFileStatus,
    debouncedAssigneeIds,
    debouncedDuplicateStatuses,
    debouncedSearchQuery,
    enableSearchMethods,
    enableKeywords,
    enableLabels,
    enablePublicationFilters,
    enableFileStatus,
    enableAssignees,
    enableDuplicates,
  ]);

  return {
    // Optimistic state (for UI - checkboxes show immediately)
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

    // Debounced filters (for API calls)
    filters: getActiveFilters(),

    // Setters
    setSearchQuery,
    setIncludeKeywords,
    setExcludeKeywords,
    setSearchMethodIds,

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

    // Select all handlers
    handleSelectAllIncludeKeywords,
    handleSelectAllExcludeKeywords,
    handleSelectAllLabels,
    handleSelectAllPublicationTypes,
    handleSelectAllPublicationYears,
    handleSelectAllAssignees,
    handleSelectAllSearchMethods,

    // Reset
    handleResetAllFilters,

    // Utility
    isDebouncing: timeoutRef.current !== undefined,
  };
}
