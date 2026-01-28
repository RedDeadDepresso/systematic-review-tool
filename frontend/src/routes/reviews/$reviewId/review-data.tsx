import { AppLayoutContext } from '@/context/app-layout-context';
import {
  useAttachPDFsToReferences,
  useFetchReviewData,
} from '@/hooks/use-reference';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { ReviewHeader } from '@/components/shared/review-header';
import { SourcesSidebar } from '@/components/review-data/sources-sidebar';
import { ReferencesTable } from '@/components/shared/references-table';
import { FiltersSidebar } from '@/components/shared/filters-sidebar';
import { ReferenceDrawer } from '@/components/shared/reference-drawer';
import type {
  ArticleViewLayout,
  Reference,
  ReferencePDFMapping,
  SortDirection,
  SortField,
} from '@/types/reference';
import type { Criteria } from '@/components/shared/screening-criteria-popover';
import type { FetchReviewDataParams } from '@/api/reference';
import { useQueryClient } from '@tanstack/react-query';
import { useDetectDuplicateReferences } from '@/hooks/use-reference-duplicate';
import { useUploadReviewReferences } from '@/hooks/use-review';
import { useFetchUploadedPDFs, useUploadPDF } from '@/hooks/use-uploaded-pdf';
import { MatchPDFDialog } from '@/components/shared/match-pdf-dialog';
import { FileUploadDialog } from '@/components/shared/file-upload-dialog';
import type { Keyword } from '@/types/keyword';
import { useCreateKeyword, useDeleteKeyword } from '@/hooks/use-keyword';
import { ReferenceDetailPanel } from '../../../components/shared/reference-panel';
import { TableTopHeader } from '@/components/shared/references-table-top-header';

export const Route = createFileRoute('/reviews/$reviewId/review-data')({
  component: RouteComponent,
});

function buildQueryParams(params: {
  review: number;
  searchMethodIds: number[];
  includeKeywords: string[];
  excludeKeywords: string[];
  labelIds: number[];
  duplicateStatuses: string[];
  searchQuery: string;
}): FetchReviewDataParams {
  const queryParams: FetchReviewDataParams = {
    review: params.review,
  };

  if (params.searchMethodIds.length > 0) {
    queryParams.searchMethodIds = params.searchMethodIds;
  }
  if (params.includeKeywords.length > 0) {
    queryParams.includeKeywords = params.includeKeywords;
  }
  if (params.excludeKeywords.length > 0) {
    queryParams.excludeKeywords = params.excludeKeywords;
  }
  if (params.labelIds.length > 0) {
    queryParams.labelIds = params.labelIds;
  }
  if (params.duplicateStatuses.length > 0) {
    queryParams.duplicateStatuses = params.duplicateStatuses;
  }
  if (params.searchQuery?.trim()) {
    queryParams.searchQuery = params.searchQuery.trim();
  }

  return queryParams;
}

function RouteComponent() {
  const reviewId = Number(Route.useParams().reviewId);
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('Review Data');
    setIsAuthenticated(true);
  }, []);

  const [selectedSearchMethodIds, setSelectedSearchMethods] = useState<
    number[]
  >([]);
  const [selectedIncludeKeywords, setSelectedIncludeKeywords] = useState<
    string[]
  >([]);
  const [selectedExcludeKeywords, setSelectedExcludeKeywords] = useState<
    string[]
  >([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([]);
  const [selectedDuplicateStatuses, setSelectedDuplicateStatuses] = useState<
    string[]
  >([]);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<number[]>(
    []
  );
  const [highlightedReferenceId, setHighlightedReferenceId] = useState<
    number | null
  >(null);
  const [highlightedReference, setHighlightedReference] =
    useState<Reference | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sidebar collapse states - collapsed by default on mobile
  const [isSourcesSidebarCollapsed, setIsSourcesSidebarCollapsed] =
    useState(true);
  const [isFiltersSidebarCollapsed, setIsFiltersSidebarCollapsed] =
    useState(true);

  // Detect if mobile and auto-collapse sidebars
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

    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Drawer state
  const [openDetailId, setOpenDetailId] = useState<number | null>(null);

  // Highlight toggle states
  const [includeHighlightEnabled, setIncludeHighlightEnabled] = useState(true);
  const [excludeHighlightEnabled, setExcludeHighlightEnabled] = useState(true);

  // Local keywords state (for newly created keywords)
  const [localKeywords, setLocalKeywords] = useState<Keyword[]>([]);
  const createKeyword = useCreateKeyword();
  const deleteKeyword = useDeleteKeyword();

  // Screening criteria state
  const [screeningCriteria, setScreeningCriteria] = useState<Criteria[]>([]);

  // Article view layout state
  const [articleViewLayout, setArticleViewLayout] =
    useState<ArticleViewLayout>('title-only');

  // File Upload
  const [openUploadBibDialog, setOpenUploadBibDialog] = useState(false);
  const [openUploadPDFDialog, setOpenUploadPDFDialog] = useState(false);
  const [openMatchDialog, setOpenMatchDialog] = useState(false);
  const usefetchUploadedPDFs = useFetchUploadedPDFs(reviewId);
  const uploadPDF = useUploadPDF();
  const attachPDFsToReferences = useAttachPDFsToReferences();
  const detectDuplicateReferences = useDetectDuplicateReferences();
  const uploadReviewReferences = useUploadReviewReferences();
  const queryParams = buildQueryParams({
    review: reviewId,
    searchMethodIds: selectedSearchMethodIds,
    includeKeywords: selectedIncludeKeywords,
    excludeKeywords: selectedExcludeKeywords,
    duplicateStatuses: selectedDuplicateStatuses,
    labelIds: selectedLabelIds,
    searchQuery,
  });

  const { data, isLoading, error } = useFetchReviewData(queryParams);

  const queryClient = useQueryClient();

  const invalidateQuery = () => {
    queryClient.invalidateQueries({
      queryKey: ['reviews', queryParams.review, 'review-data'],
    });
  };

  const handleLabelsApplied = useCallback(() => {
    invalidateQuery();
  }, [queryClient]);

  const handleUploadPDF = async (file: File): Promise<boolean> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      await uploadPDF.mutateAsync({
        file,
        review: reviewId,
      });
      setOpenMatchDialog(true);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleUploadReferences = async (file: File): Promise<boolean> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      await uploadReviewReferences.mutateAsync({
        reviewId,
        formData,
      });
      invalidateQuery();
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleMatch = async (
    mappings: ReferencePDFMapping[]
  ): Promise<boolean> => {
    try {
      // Call API to attach PDFs to references
      await attachPDFsToReferences.mutateAsync({ reviewId, mappings });
      setOpenMatchDialog(false);
      invalidateQuery();
      return true;
    } catch (error) {
      return false;
    }
  };

  // Sort references client-side
  const sortedReferences = useMemo(() => {
    if (!data?.references || !sortField) return data?.references || [];

    const refs = [...data.references];
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
  }, [data?.references, sortField, sortDirection]);

  const handleSearchMethodToggle = useCallback((id: number) => {
    setSelectedSearchMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAllReferences = useCallback(() => {
    setSelectedSearchMethods([]);
  }, []);

  const handleDuplicateStatusToggle = useCallback((status: string) => {
    setSelectedDuplicateStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  }, []);

  const handleIncludeKeywordToggle = useCallback((keyword: string) => {
    setSelectedIncludeKeywords((prev) =>
      prev.includes(keyword)
        ? prev.filter((k) => k !== keyword)
        : [...prev, keyword]
    );
  }, []);

  const handleExcludeKeywordToggle = useCallback((keyword: string) => {
    setSelectedExcludeKeywords((prev) =>
      prev.includes(keyword)
        ? prev.filter((k) => k !== keyword)
        : [...prev, keyword]
    );
  }, []);

  const handleSelectAllInclude = useCallback(() => {
    if (!data) return;
    const includeKeywords = data.keywords.filter((k) => k.isInclusive);
    const allSelected = includeKeywords.every((k) =>
      selectedIncludeKeywords.includes(k.name)
    );
    if (allSelected) {
      setSelectedIncludeKeywords([]);
    } else {
      setSelectedIncludeKeywords(includeKeywords.map((k) => k.name));
    }
  }, [data, selectedIncludeKeywords]);

  const handleSelectAllExclude = useCallback(() => {
    if (!data) return;
    const excludeKeywords = data.keywords.filter((k) => !k.isInclusive);
    const allSelected = excludeKeywords.every((k) =>
      selectedExcludeKeywords.includes(k.name)
    );
    if (allSelected) {
      setSelectedExcludeKeywords([]);
    } else {
      setSelectedExcludeKeywords(excludeKeywords.map((k) => k.name));
    }
  }, [data, selectedExcludeKeywords]);

  const handleReferenceSelect = useCallback((id: number) => {
    setSelectedReferenceIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }, []);

  const handleHighlightReference = useCallback((id: number | null) => {
    setHighlightedReferenceId(id);
  }, []);

  useEffect(() => {
    if (!highlightedReferenceId && articleViewLayout !== 'title-abstract') {
      setHighlightedReference(null);
      return;
    }

    const reference = data?.references.find(
      (r) => r.id === highlightedReferenceId
    );

    setHighlightedReference(reference ?? null);
  }, [highlightedReferenceId, data?.references, articleViewLayout]);

  const handleSelectAllTableReferences = useCallback(() => {
    if (!data) return;
    const allSelected = data.references.every((r) =>
      selectedReferenceIds.includes(r.id)
    );
    if (allSelected) {
      setSelectedReferenceIds([]);
    } else {
      setSelectedReferenceIds(data.references.map((r) => r.id));
    }
  }, [data, selectedReferenceIds]);

  const combinedReferences = useMemo(() => {
    if (!openMatchDialog) return [];

    if (!data?.references) return [];

    return data.references
      .filter(
        (ref) =>
          selectedReferenceIds.includes(ref.id) ||
          ref.id === highlightedReferenceId
      )
      .map((ref) => ({
        ...ref,
        isSelected: selectedReferenceIds.includes(ref.id),
        isHighlighted: ref.id === highlightedReferenceId,
      }));
  }, [openMatchDialog, data, selectedReferenceIds, highlightedReferenceId]);

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

  const openDetail = useMemo(() => {
    if (!openDetailId) return null;

    return data?.references.find((r) => r.id === openDetailId) ?? null;
  }, [openDetailId, data?.references]);

  const handleCreateKeyword = useCallback(
    async (name: string, isInclusive: boolean) => {
      try {
        const newKeword = await createKeyword.mutateAsync({
          review: reviewId,
          name: name,
          isInclusive: isInclusive,
        });

        setLocalKeywords((prev) => {
          // Prevent duplicates (case-insensitive)
          if (prev.some((k) => k.name.toLowerCase() === name.toLowerCase())) {
            return prev;
          }
          return [...prev, newKeword];
        });

        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    },
    [createKeyword, reviewId]
  );

  const handleDeleteKeyword = useCallback(
    async (keyword: Keyword) => {
      try {
        await deleteKeyword.mutateAsync(keyword.id);

        setLocalKeywords((prev) => prev.filter((k) => k.id !== keyword.id));

        if (keyword.isInclusive) {
          setSelectedIncludeKeywords((prev) =>
            prev.filter((k) => k !== keyword.name)
          );
        } else {
          setSelectedExcludeKeywords((prev) =>
            prev.filter((k) => k !== keyword.name)
          );
        }

        queryClient.invalidateQueries({
          queryKey: ['reviews', reviewId, 'review-data'],
        });

        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    },
    [deleteKeyword, reviewId, queryClient]
  );

  const handleNavigateDetail = useCallback(
    (direction: 'prev' | 'next') => {
      if (!sortedReferences || openDetailId === null) return;
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

  // Combine API keywords with local keywords
  const allKeywords = useMemo(() => {
    const apiKeywords = data?.keywords || [];
    const combined = [...apiKeywords];
    for (const localKw of localKeywords) {
      if (
        !combined.some(
          (k) => k.name.toLowerCase() === localKw.name.toLowerCase()
        )
      ) {
        combined.push(localKw);
      }
    }
    return combined;
  }, [data?.keywords, localKeywords]);

  const highlightIncludeKeywords = includeHighlightEnabled
    ? allKeywords.filter((k) => k.isInclusive).map((k) => k.name)
    : [];
  const highlightExcludeKeywords = excludeHighlightEnabled
    ? allKeywords.filter((k) => !k.isInclusive).map((k) => k.name)
    : [];

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading references...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-destructive">Error loading references</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <FileUploadDialog
        open={openUploadBibDialog}
        onOpenChange={setOpenUploadBibDialog}
        title="Upload References"
        description="Add references to the review"
        acceptedFormats=".bib,application/x-bibtex"
        acceptedMimeTypes={['application/x-bibtex']}
        fileTypeLabel="BibTeX"
        onUpload={handleUploadReferences}
      />
      <FileUploadDialog
        open={openUploadPDFDialog}
        onOpenChange={setOpenUploadPDFDialog}
        onUpload={handleUploadPDF}
      />
      {openMatchDialog && (
        <MatchPDFDialog
          open={openMatchDialog}
          onOpenChange={setOpenMatchDialog}
          references={combinedReferences}
          uploadedPDFs={usefetchUploadedPDFs.data || []}
          onImport={handleMatch}
        />
      )}
      <ReviewHeader
        reviewId={reviewId}
        screeningCriteria={screeningCriteria}
        onScreeningCriteriaChange={setScreeningCriteria}
      />
      <div className="flex flex-1 overflow-hidden">
        <SourcesSidebar
          searchMethods={data?.searchMethods || []}
          selectedSearchMethodIds={selectedSearchMethodIds}
          onSearchMethodToggle={handleSearchMethodToggle}
          onSelectAllReferences={handleSelectAllReferences}
          duplicateStatusCounts={
            data?.duplicateStatusCounts || {
              Unresolved: 0,
              Deleted: 0,
              'Not Duplicate': 0,
              Resolved: 0,
            }
          }
          selectedDuplicateStatuses={selectedDuplicateStatuses}
          onDuplicateStatusToggle={handleDuplicateStatusToggle}
          totalReferences={data?.totalCount || 0}
          isCollapsed={isSourcesSidebarCollapsed}
          onAddReferences={() => setOpenUploadBibDialog(true)}
          onDetectDuplicates={() =>
            detectDuplicateReferences.mutate({ reviewId })
          }
        />

        <div className="flex flex-col flex-1">
          <TableTopHeader
            filteredCount={data?.filteredCount || 0}
            totalCount={data?.totalCount || 0}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSortChange={handleSortChange}
            isLeftCollapsed={isSourcesSidebarCollapsed}
            onToggleLeftCollapse={() =>
              setIsSourcesSidebarCollapsed(!isSourcesSidebarCollapsed)
            }
            isRightCollapsed={isFiltersSidebarCollapsed}
            onToggleRightCollapse={() =>
              setIsFiltersSidebarCollapsed(!isFiltersSidebarCollapsed)
            }
          />
          <div className="flex flex-1 overflow-hidden">
            <ReferencesTable
              references={sortedReferences}
              selectedReferenceIds={selectedReferenceIds}
              highlightedReferenceId={highlightedReferenceId}
              onSelectReference={handleReferenceSelect}
              onHighlightReference={handleHighlightReference}
              onSelectAll={handleSelectAllTableReferences}
              highlightIncludeKeywords={highlightIncludeKeywords}
              highlightExcludeKeywords={highlightExcludeKeywords}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
              onOpenDetail={handleOpenDetail}
              onLabelsApplied={handleLabelsApplied}
              onAttachPDF={() => setOpenUploadPDFDialog(true)}
              viewLayout={articleViewLayout}
            />

            {articleViewLayout === 'title-abstract' && (
              <ReferenceDetailPanel
                reference={highlightedReference}
                onClose={() => handleHighlightReference(null)}
                highlightIncludeKeywords={highlightIncludeKeywords}
                highlightExcludeKeywords={highlightExcludeKeywords}
                onAttachPDF={() => setOpenUploadPDFDialog(true)}
              />
            )}

            <FiltersSidebar
              keywords={allKeywords}
              selectedIncludeKeywords={selectedIncludeKeywords}
              selectedExcludeKeywords={selectedExcludeKeywords}
              onIncludeKeywordToggle={handleIncludeKeywordToggle}
              onExcludeKeywordToggle={handleExcludeKeywordToggle}
              onSelectAllInclude={handleSelectAllInclude}
              onSelectAllExclude={handleSelectAllExclude}
              isCollapsed={isFiltersSidebarCollapsed}
              onToggleCollapse={() =>
                setIsFiltersSidebarCollapsed(!isFiltersSidebarCollapsed)
              }
              includeHighlightEnabled={includeHighlightEnabled}
              excludeHighlightEnabled={excludeHighlightEnabled}
              onToggleIncludeHighlight={() =>
                setIncludeHighlightEnabled(!includeHighlightEnabled)
              }
              onToggleExcludeHighlight={() =>
                setExcludeHighlightEnabled(!excludeHighlightEnabled)
              }
              onCreateKeyword={handleCreateKeyword}
              onDeleteKeyword={handleDeleteKeyword}
              articleViewLayout={articleViewLayout}
              onArticleViewLayoutChange={setArticleViewLayout}
            />
          </div>
        </div>
      </div>
      {openDetail && (
        <ReferenceDrawer
          reference={openDetail}
          onClose={handleCloseDetail}
          onNavigate={handleNavigateDetail}
          hasPrev={currentDetailIndex > 0}
          hasNext={
            currentDetailIndex < sortedReferences.length - 1 &&
            currentDetailIndex !== -1
          }
          highlightIncludeKeywords={highlightIncludeKeywords}
          highlightExcludeKeywords={highlightExcludeKeywords}
        />
      )}
    </div>
  );
}
