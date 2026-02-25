import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchScreening } from '@/features/references/hooks/use-references';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useState, useEffect, useCallback } from 'react';
import { ReferencesTable } from '@/features/references/components/references/references-table';
import { FiltersSidebar } from '@/features/references/components/references/filters-sidebar';
import { ScreeningReferenceDrawer } from '@/features/references/components/references/reference-drawer';
import { ScreeningReferenceDetailPanel } from '@/features/references/components/references/reference-panel';
import {
  TableTopHeader,
  type ExportType,
} from '@/features/references/components/references/references-table-top-header';
import { FileUploadDialog } from '@/components/blocks/file-upload-dialog';
import { MatchPDFDialog } from '@/features/references/components/uploaded-pdfs/match-pdf-dialog';
import type {
  ArticleViewLayout,
  OpinionStatus,
} from '@/features/references/types/references';
import { useReferenceFilters } from '@/features/references/hooks/use-reference-filters';
import { useReferenceUI } from '@/features/references/hooks/use-reference-ui';
import { useKeywordManagement } from '@/features/references/hooks/use-keyword-management';
import { useFileUpload } from '@/features/references/hooks/use-reference-file-upload';
import { useQueryClient } from '@tanstack/react-query';
import { ReferencesTableBody } from '@/features/references/components/references/references-table-body';
import { ScreeningFooter } from '@/features/references/components/references/references-table-footer';
import { TableSubHeader } from '@/features/references/components/references/references-table-sub-header';
import { useBulkUpsertReferenceOpinions } from '@/features/references/hooks/use-reference-opinions';
import { PDFDialog } from '@/components/blocks/pdf-dialog/pdf-dialog';
import { useFetchReview } from '@/features/reviews/hooks/use-reviews';
import {
  exportScreening,
  type LabelCount,
  type SearchMethod,
} from '@/features/references/api/references';
import { useScreeningStats } from '@/features/reviews/hooks/use-screening-stats';
import { cn } from '@/lib/utils';
import { useDeleteSearchMethod } from '@/features/reviews/hooks/use-search-methods';
import { useDeleteLabel } from '@/features/references/hooks/use-labels';

export const Route = createFileRoute('/reviews/$reviewId/screening')({
  component: RouteComponent,
});

function RouteComponent() {
  const reviewId = Number(Route.useParams().reviewId);
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);
  const queryClient = useQueryClient();

  // Auto-track when on this page
  useScreeningStats({
    reviewId: reviewId,
    autoTrack: true, // Will pause when leaving route
  });

  useEffect(() => {
    setPageTitle('Screening');
    setIsAuthenticated(true);
    setScroll(false);
  }, []);

  // Feature flags - all enabled
  const filters = useReferenceFilters({
    enableSearchMethods: true,
    enableKeywords: true,
    enableLabels: true,
    enablePublicationFilters: true,
    enableFileStatus: true,
    enableAssignees: true,
    enableDuplicates: true,
    debounceDelay: 1500,
  });

  // Highlight toggle states
  const [includeHighlightEnabled, setIncludeHighlightEnabled] = useState(true);
  const [excludeHighlightEnabled, setExcludeHighlightEnabled] = useState(true);

  // Article view layout state
  const [articleViewLayout, setArticleViewLayout] =
    useState<ArticleViewLayout>('title-abstract');

  // Fetch data
  const queryParams = {
    review: reviewId,
    ...filters.filters,
  };

  const { data, isLoading, error } = useFetchScreening(queryParams);
  const invalidateQuery = () => {
    queryClient.invalidateQueries({
      queryKey: ['reviews', 'screening', queryParams],
    });
  };
  const fetchReview = useFetchReview(reviewId);

  const deleteSearchMethod = useDeleteSearchMethod(reviewId);
  const deleteLabel = useDeleteLabel();

  const handleDeleteLabel = useCallback(
    (label: LabelCount) => {
      deleteLabel.mutate(label.id, {
        onSuccess: () => {
          invalidateQuery();
        },
      });
    },
    [deleteLabel]
  );

  const handleDeleteSearchMethod = useCallback(
    (searchMethod: SearchMethod) => {
      deleteSearchMethod.mutate(searchMethod.id, {
        onSuccess: () => {
          invalidateQuery();
        },
      });
    },
    [deleteSearchMethod]
  );

  // UI state management
  const ui = useReferenceUI(
    data?.references || [],
    fetchReview.data?.userMemberId || undefined
  );

  // Keyword management
  const keywords = useKeywordManagement(
    reviewId,
    data?.keywords,
    includeHighlightEnabled,
    excludeHighlightEnabled,
    filters.includeKeywords,
    filters.excludeKeywords,
    (kws) => filters.setIncludeKeywords?.(kws),
    (kws) => filters.setExcludeKeywords?.(kws)
  );

  // File upload management
  const fileUpload = useFileUpload(
    reviewId,
    invalidateQuery,
    ui.selectedReferenceIds,
    ui.highlightedReferenceId,
    ui.sortedReferences
  );

  const handleExport = useCallback(
    (exportType: ExportType) => {
      const filename = `review-${reviewId}-screening${exportType === 'all' ? '' : '-filtered'}.bib`;
      exportType === 'all'
        ? exportScreening(filename)
        : exportScreening(filename, queryParams);
    },
    [queryParams]
  );

  const bulkUpsertReferenceOpinions = useBulkUpsertReferenceOpinions();

  const handleOpinionApplied = async (
    referenceIds: number[],
    status: OpinionStatus,
    reasonId?: number | null
  ) => {
    try {
      await bulkUpsertReferenceOpinions.mutateAsync({
        payload: {
          referenceIds: referenceIds,
          status: status,
          stage: 'screening',
          reason: reasonId,
        },
      });
      invalidateQuery();
      if (
        referenceIds.length === 1 &&
        referenceIds[0] === ui.highlightedReferenceId
      )
        ui.handleNavigateDetail('next');
    } catch (error) {
      console.error('Failed to update reference: ', error);
    }
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-destructive">Error loading references</div>
      </div>
    );
  }

  return (
    <>
      {/* Dialogs */}
      {ui.openPDFId && ui.openPDFReference && ui.openPDFReference.file && (
        <PDFDialog
          reviewId={reviewId}
          referenceId={ui.openPDFId}
          open={ui.openPDFReference !== null}
          onOpenChange={ui.handleClosePDF}
          title={ui.openPDFReference.title}
          fileUrl={ui.openPDFReference.file}
          userRole={fetchReview.data?.userRole || 'Viewer'}
          hasNext={ui.hasOpenPDFReferenceNext}
          hasPrev={ui.hasOpenPDFReferencePrev}
          onNavigate={ui.handleOpenPDFNavigate}
          footer={
            <ScreeningFooter
              reviewId={reviewId}
              userRole={fetchReview.data?.userRole || 'Viewer'}
              selectedReferenceIds={[]}
              highlightedReferenceId={ui.openPDFId}
              onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
              onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
              onOpinionApplied={handleOpinionApplied}
              opinionStatus={ui.PDFOpinionStatus}
            />
          }
        />
      )}
      <FileUploadDialog
        open={fileUpload.openUploadPDFDialog}
        onOpenChange={fileUpload.setOpenUploadPDFDialog}
        onUpload={fileUpload.handleUploadPDF}
        onAllSuccess={() => fileUpload.setOpenMatchDialog(true)}
      />
      {fileUpload.openMatchDialog && (
        <MatchPDFDialog
          open={fileUpload.openMatchDialog}
          onOpenChange={fileUpload.setOpenMatchDialog}
          references={fileUpload.combinedReferences}
          uploadedPDFs={fileUpload.uploadedPDFs}
          onImport={fileUpload.handleMatch}
          onAutoMatch={fileUpload.handleAutoMatch}
        />
      )}
      <div className="h-full flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col flex-1 min-h-0">
            {/* Table Header */}
            <TableTopHeader
              userRole={fetchReview.data?.userRole || 'Viewer'}
              filteredCount={data?.filteredCount || 0}
              totalCount={data?.totalCount || 0}
              searchQuery={filters.searchQuery}
              onSearchChange={filters.setSearchQuery}
              onSortChange={ui.handleSortChange}
              isRightCollapsed={ui.isFiltersSidebarCollapsed}
              onToggleRightCollapse={() =>
                ui.setIsFiltersSidebarCollapsed(!ui.isFiltersSidebarCollapsed)
              }
              onExport={handleExport}
              breakButtonReviewId={reviewId}
            />

            <div className="flex flex-1 overflow-hidden">
              <div
                className={cn(
                  'flex flex-col min-h-0 overflow-hidden min-w-0',
                  articleViewLayout === 'title-abstract' ? 'w-80' : 'flex-1'
                )}
              >
                {/* References Table */}
                <ReferencesTable viewLayout={articleViewLayout}>
                  <TableSubHeader
                    allSelected={ui.allSelected}
                    onSelectAll={ui.handleSelectAllReferences}
                    sortField={ui.sortField}
                    sortDirection={ui.sortDirection}
                    onSortChange={ui.handleSortChange}
                    viewLayout={articleViewLayout}
                  />
                  <ReferencesTableBody
                    references={ui.sortedReferences}
                    selectedReferenceIds={ui.selectedReferenceIds}
                    highlightedReferenceId={ui.highlightedReferenceId}
                    onSelectReference={ui.handleReferenceSelect}
                    onHighlightReference={ui.handleHighlightReference}
                    highlightIncludeKeywords={keywords.highlightIncludeKeywords}
                    highlightExcludeKeywords={keywords.highlightExcludeKeywords}
                    onOpenDetail={ui.handleOpenDetail}
                    viewLayout={articleViewLayout}
                    onOpenPDF={ui.handleOpenPDF}
                    isLoading={isLoading}
                  />
                </ReferencesTable>
                {articleViewLayout !== 'title-abstract' && (
                  <ScreeningFooter
                    reviewId={reviewId}
                    userRole={fetchReview.data?.userRole || 'Viewer'}
                    selectedReferenceIds={ui.selectedReferenceIds}
                    highlightedReferenceId={ui.highlightedReferenceId}
                    onLabelsApplied={invalidateQuery}
                    onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
                    onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
                    onOpinionApplied={handleOpinionApplied}
                  />
                )}
              </div>

              {/* Detail Panel */}
              {articleViewLayout === 'title-abstract' && (
                <ScreeningReferenceDetailPanel
                  reviewId={reviewId}
                  userRole={fetchReview.data?.userRole || 'Viewer'}
                  reference={
                    data?.references.find(
                      (r) => r.id === ui.highlightedReferenceId
                    ) || null
                  }
                  onClose={() => ui.handleHighlightReference(null)}
                  selectedReferenceIds={ui.selectedReferenceIds}
                  highlightedReferenceId={ui.highlightedReferenceId}
                  highlightIncludeKeywords={keywords.highlightIncludeKeywords}
                  highlightExcludeKeywords={keywords.highlightExcludeKeywords}
                  onLabelsApplied={invalidateQuery}
                  onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
                  onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
                  onOpinionApplied={handleOpinionApplied}
                />
              )}

              {/* Filters Sidebar */}
              <FiltersSidebar
                reviewId={reviewId}
                userRole={fetchReview.data?.userRole || 'Viewer'}
                keywords={keywords.allKeywords}
                labels={data?.labels || []}
                publicationTypes={data?.publicationTypes || []}
                publicationYears={data?.publicationYears || []}
                fileCounts={data?.fileCounts || { withFile: 0, withoutFile: 0 }}
                assignees={data?.assignees || []}
                searchMethods={data?.searchMethods || []}
                selectedIncludeKeywords={filters.includeKeywords}
                selectedExcludeKeywords={filters.excludeKeywords}
                selectedLabels={filters.labelIds}
                selectedPublicationTypes={filters.publicationTypes}
                selectedPublicationYears={filters.publicationYears}
                selectedFileStatus={filters.fileStatus}
                selectedAssignees={filters.assigneeIds}
                selectedSearchMethods={filters.searchMethodIds}
                onIncludeKeywordToggle={filters.handleIncludeKeywordToggle}
                onExcludeKeywordToggle={filters.handleExcludeKeywordToggle}
                onSelectAllInclude={() => {
                  // Get all include keywords from data
                  const allIncludeKeywords = keywords.allKeywords
                    .filter((k) => k.isInclusive)
                    .map((k) => k.name);

                  // Call the handler with the full list
                  filters.handleSelectAllIncludeKeywords(allIncludeKeywords);
                }}
                onSelectAllExclude={() => {
                  // Get all exclude keywords from data
                  const allExcludeKeywords = keywords.allKeywords
                    .filter((k) => !k.isInclusive)
                    .map((k) => k.name);

                  filters.handleSelectAllExcludeKeywords(allExcludeKeywords);
                }}
                onLabelToggle={filters.handleLabelToggle}
                onSelectAllLabels={() => {
                  // Get all label IDs from data
                  const allLabelIds = (data?.labels || []).map((l) => l.id);
                  filters.handleSelectAllLabels(allLabelIds);
                }}
                onPublicationTypeToggle={filters.handlePublicationTypeToggle}
                onSelectAllPublicationTypes={() => {
                  // Get all publication types from data
                  const allTypes = (data?.publicationTypes || []).map(
                    (pt) => pt.publicationType
                  );
                  filters.handleSelectAllPublicationTypes(allTypes);
                }}
                onPublicationYearToggle={filters.handlePublicationYearToggle}
                onSelectAllPublicationYears={() => {
                  // Get all years from data
                  const allYears = (data?.publicationYears || []).map(
                    (py) => py.year
                  );
                  filters.handleSelectAllPublicationYears(allYears);
                }}
                onFileStatusChange={filters.handleFileStatusChange}
                onAssigneeToggle={filters.handleAssigneeToggle}
                onSelectAllAssignees={() => {
                  // Get all assignee IDs from data
                  const allAssigneeIds = (data?.assignees || []).map(
                    (a) => a.Id
                  );
                  filters.handleSelectAllAssignees(allAssigneeIds);
                }}
                onSearchMethodToggle={filters.handleSearchMethodToggle}
                onSelectAllSearchMethods={() => {
                  // Get all search method IDs from data
                  const allMethodIds = (data?.searchMethods || []).map(
                    (sm) => sm.id
                  );
                  filters.handleSelectAllSearchMethods(allMethodIds);
                }}
                onResetAllFilters={filters.handleResetAllFilters}
                isCollapsed={ui.isFiltersSidebarCollapsed}
                onToggleCollapse={() =>
                  ui.setIsFiltersSidebarCollapsed(!ui.isFiltersSidebarCollapsed)
                }
                includeHighlightEnabled={includeHighlightEnabled}
                excludeHighlightEnabled={excludeHighlightEnabled}
                onToggleIncludeHighlight={() =>
                  setIncludeHighlightEnabled(!includeHighlightEnabled)
                }
                onToggleExcludeHighlight={() =>
                  setExcludeHighlightEnabled(!excludeHighlightEnabled)
                }
                onCreateKeyword={keywords.handleCreateKeyword}
                onDeleteKeyword={keywords.handleDeleteKeyword}
                onDeleteLabel={handleDeleteLabel}
                onDeleteSearchMethod={handleDeleteSearchMethod}
                articleViewLayout={articleViewLayout}
                onArticleViewLayoutChange={setArticleViewLayout}
              />
            </div>
          </div>
        </div>

        {/* Reference Drawer */}
        {ui.openDetail && (
          <ScreeningReferenceDrawer
            reviewId={reviewId}
            userRole={fetchReview.data?.userRole || 'Viewer'}
            reference={ui.openDetail}
            onClose={ui.handleCloseDetail}
            onNavigate={ui.handleNavigateDetail}
            hasPrev={ui.currentDetailIndex > 0}
            hasNext={ui.currentDetailIndex < ui.sortedReferences.length - 1}
            highlightIncludeKeywords={keywords.highlightIncludeKeywords}
            highlightExcludeKeywords={keywords.highlightExcludeKeywords}
            selectedReferenceIds={ui.selectedReferenceIds}
            highlightedReferenceId={ui.highlightedReferenceId}
            onLabelsApplied={invalidateQuery}
            onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
            onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
            onOpinionApplied={handleOpinionApplied}
          />
        )}
      </div>
    </>
  );
}
