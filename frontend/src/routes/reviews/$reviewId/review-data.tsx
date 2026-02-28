import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchReviewData } from '@/features/references/hooks/use-references';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useState, useEffect } from 'react';
import { SourcesSidebar } from '@/features/references/components/references/sources-sidebar';
import { ReferencesTable } from '@/features/references/components/references/references-table';
import { FiltersSidebar } from '@/features/references/components/references/filters-sidebar';
import { ReviewDataReferenceDrawer } from '@/features/references/components/references/reference-drawer';
import { ReviewDataReferenceDetailPanel } from '@/features/references/components/references/reference-panel';
import {
  TableTopHeader,
  type ExportType,
} from '@/features/references/components/references/references-table-top-header';
import { ResolveDuplicatesDialog } from '@/features/references/components/reference-duplicates/resolve-duplicates-dialog';
import { FileUploadDialog } from '@/components/blocks/file-upload-dialog';
import { MatchPDFDialog } from '@/features/references/components/uploaded-pdfs/match-pdf-dialog';
import type { ArticleViewLayout } from '@/features/references/types/references';
import { useReferenceFilters } from '@/features/references/hooks/use-reference-filters';
import { useReferenceUI } from '@/features/references/hooks/use-reference-ui';
import { useKeywordManagement } from '@/features/references/hooks/use-keyword-management';
import { useFileUpload } from '@/features/references/hooks/use-reference-file-upload';
import { useQueryClient } from '@tanstack/react-query';
import { ReferencesTableBody } from '@/features/references/components/references/references-table-body';
import { ReviewDataFooter } from '@/features/references/components/references/references-table-footer';
import { TableSubHeader } from '@/features/references/components/references/references-table-sub-header';
import { PDFDialog } from '@/components/blocks/pdf-dialog/pdf-dialog';
import { useFetchReview } from '@/features/reviews/hooks/use-reviews';
import {
  exportReviewData,
  type LabelCount,
  type SearchMethod,
} from '@/features/references/api/references';
import { cn } from '@/lib/utils';
import { useDeleteSearchMethod } from '@/features/reviews/hooks/use-search-methods';
import { useDeleteLabel } from '@/features/references/hooks/use-labels';

export const Route = createFileRoute('/reviews/$reviewId/review-data')({
  component: RouteComponent,
});

function RouteComponent() {
  const reviewId = Number(Route.useParams().reviewId);
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);
  const queryClient = useQueryClient();
  const deleteSearchMethod = useDeleteSearchMethod(reviewId);

  useEffect(() => {
    setPageTitle('Review Data');
    setIsAuthenticated(true);
    setScroll(false);
  }, []);

  // Feature flags - all enabled
  const filters = useReferenceFilters({
    enableOpinions: false,
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
    useState<ArticleViewLayout>('title-only');

  // Resolve duplicates dialog
  const [isResolveDuplicatesOpen, setIsResolveDuplicatesOpen] = useState(false);

  // Fetch data
  const queryParams = {
    review: reviewId,
    ...filters.filters,
  };

  const { data, isLoading, error } = useFetchReviewData(queryParams);
  const invalidateQuery = () => {
    queryClient.invalidateQueries({
      queryKey: ['reviews', 'review-data', queryParams],
    });
  };
  const fetchReview = useFetchReview(reviewId);

  // UI state management
  const ui = useReferenceUI(data?.references || []);

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

  const deleteLabel = useDeleteLabel();

  const handleDeleteLabel = (label: LabelCount) => {
    deleteLabel.mutate(label.id, {
      onSuccess: () => {
        invalidateQuery();
      },
    });
  };

  const handleDeleteSearchMethod = (searchMethod: SearchMethod) => {
    deleteSearchMethod.mutate(searchMethod.id, {
      onSuccess: invalidateQuery,
    });
  };

  const handleExport = (exportType: ExportType) => {
    const filename = `review-${reviewId}-review-data${exportType === 'all' ? '' : '-filtered'}.bib`;
    exportType === 'all'
      ? exportReviewData(filename)
      : exportReviewData(filename, queryParams);
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
        />
      )}
      <ResolveDuplicatesDialog
        reviewId={reviewId}
        isOpen={isResolveDuplicatesOpen}
        onClose={() => setIsResolveDuplicatesOpen(false)}
      />
      <FileUploadDialog
        open={fileUpload.openUploadBibDialog}
        onOpenChange={fileUpload.setOpenUploadBibDialog}
        title="Upload References"
        description="Add references to the review (BibTeX, RIS, or EndNote XML format)"
        acceptedFormats=".bib,.ris,.xml"
        fileTypeLabel="BibTeX/RIS/EndNote XML"
        onUpload={fileUpload.handleUploadReferences}
      />
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
        <div className="flex flex-1 overflow-hidden">
          {/* Sources Sidebar */}
          <SourcesSidebar
            reviewId={reviewId}
            searchMethods={data?.searchMethods || []}
            userRole={fetchReview.data?.userRole || 'Viewer'}
            selectedSearchMethodIds={filters.searchMethodIds}
            onSearchMethodToggle={filters.handleSearchMethodToggle}
            onSelectAllReferences={() => filters.setSearchMethodIds([])}
            duplicateStatusCounts={
              data?.duplicateStatusCounts || {
                Unresolved: 0,
                Deleted: 0,
                'Not Duplicate': 0,
                Resolved: 0,
              }
            }
            selectedDuplicateStatuses={filters.duplicateStatuses}
            onDuplicateStatusToggle={filters.handleDuplicateStatusToggle}
            totalReferences={data?.totalCount || 0}
            isCollapsed={ui.isSourcesSidebarCollapsed}
            onAddReferences={() => fileUpload.setOpenUploadBibDialog(true)}
            onDetectDuplicates={() =>
              fileUpload.detectDuplicateReferences.mutate({ reviewId })
            }
            onResolveDuplicates={() => setIsResolveDuplicatesOpen(true)}
            onDeleteSearchMethod={handleDeleteSearchMethod}
          />

          <div className="flex flex-col flex-1 min-h-0">
            {/* Table Header */}
            <TableTopHeader
              userRole={fetchReview.data?.userRole || 'Viewer'}
              filteredCount={data?.filteredCount || 0}
              totalCount={data?.totalCount || 0}
              searchQuery={filters.searchQuery}
              onSearchChange={filters.setSearchQuery}
              onSortChange={ui.handleSortChange}
              isLeftCollapsed={ui.isSourcesSidebarCollapsed}
              onToggleLeftCollapse={() =>
                ui.setIsSourcesSidebarCollapsed(!ui.isSourcesSidebarCollapsed)
              }
              isRightCollapsed={ui.isFiltersSidebarCollapsed}
              onToggleRightCollapse={() =>
                ui.setIsFiltersSidebarCollapsed(!ui.isFiltersSidebarCollapsed)
              }
              onExport={handleExport}
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
                    onOpenPDF={ui.handleOpenPDF}
                    viewLayout={articleViewLayout}
                    isLoading={isLoading}
                  />
                </ReferencesTable>
                {articleViewLayout !== 'title-abstract' && (
                  <ReviewDataFooter
                    reviewId={reviewId}
                    userRole={fetchReview.data?.userRole || 'Viewer'}
                    selectedReferenceIds={ui.selectedReferenceIds}
                    highlightedReferenceId={ui.highlightedReferenceId}
                    onLabelsApplied={invalidateQuery}
                    onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
                    onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
                  />
                )}
              </div>

              {/* Detail Panel */}
              {articleViewLayout === 'title-abstract' && (
                <ReviewDataReferenceDetailPanel
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
                opinionStatuses={[]}
                selectedOpinionStatuses={filters.opinionStatuses}
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
                onOpionStatusToggle={filters.handleOpinionStatusToggle}
                onSelectAllOpinionStatuses={() =>
                  filters.handleSelectAllOpinionStatuses(
                    filters.ALL_OPINION_STATUSES
                  )
                }
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
          <ReviewDataReferenceDrawer
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
          />
        )}
      </div>
    </>
  );
}
