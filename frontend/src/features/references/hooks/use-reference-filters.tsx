import type { OpinionStatus } from '@/features/references/types/references';
import { useState, useCallback } from 'react';
import { useDebounceValue } from 'usehooks-ts';

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
  opinionStatuses: OpinionStatus[];
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
  enableOpinions?: boolean;
  debounceDelay?: number;
}

export function useReferenceFilters(options: UseReviewDataFiltersOptions = {}) {
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
  const [opinionStatuses, setOpinionStatuses] = useState<OpinionStatus[]>([
    'Undecided',
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const optimisticFilters: ReviewDataFilters = {
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
  };
  const [debouncedFilters, isDebouncing] = useDebounceValue(
    optimisticFilters,
    debounceDelay
  );

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

  const handleOpinionStatusToggle = useCallback(
    (status: OpinionStatus) => {
      if (!enableOpinions) return;
      setOpinionStatuses((prev) =>
        prev.includes(status)
          ? prev.filter((s) => s !== status)
          : [...prev, status]
      );
    },
    [enableOpinions]
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

  // Select all handlers
  const handleSelectAllOpinionStatuses = useCallback(
    (allOpinionStatuses: OpinionStatus[]) => {
      if (!enableOpinions) return;
      setOpinionStatuses((prev) =>
        prev.length === allOpinionStatuses.length ? [] : allOpinionStatuses
      );
    },
    [enableOpinions]
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
    if (enableOpinions) setOpinionStatuses([]);
  }, [
    enableSearchMethods,
    enableKeywords,
    enableLabels,
    enablePublicationFilters,
    enableFileStatus,
    enableAssignees,
    enableDuplicates,
    enableOpinions,
  ]);

  return {
    // Optimistic state (for UI - checkboxes show immediately)
    ALL_OPINION_STATUSES,
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

    // Debounced filters (for API calls)
    filters: debouncedFilters,

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
    handleOpinionStatusToggle,

    // Select all handlers
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
    isDebouncing,
  };
}
