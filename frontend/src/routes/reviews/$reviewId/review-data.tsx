import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchReviewData } from '@/hooks/use-reference';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useState, useEffect } from 'react';
import { ReviewHeader } from '@/components/shared/review-header';
import { SourcesSidebar } from '@/components/review-data/sources-sidebar';
import { ReferencesTable } from '@/components/shared/references-table';
import { FiltersSidebar } from '@/components/shared/filters-sidebar';
import { ReviewDataReferenceDrawer } from '@/components/shared/reference-drawer';
import { ReviewDataReferenceDetailPanel } from '@/components/shared/reference-panel';
import { TableTopHeader } from '@/components/shared/references-table-top-header';
import { ResolveDuplicatesDialog } from '@/components/shared/resolve-duplicates-dialog';
import { FileUploadDialog } from '@/components/shared/file-upload-dialog';
import { MatchPDFDialog } from '@/components/shared/match-pdf-dialog';
import type { ArticleViewLayout } from '@/types/reference';
import { useReferenceFilters } from '@/hooks/use-reference-filters';
import { useReferenceUI } from '@/hooks/use-reference-ui';
import { useKeywordManagement } from '@/hooks/use-keyword-management';
import { useFileUpload } from '@/hooks/use-reference-file-upload';
import { useQueryClient } from '@tanstack/react-query';
import { ReferencesTableBody } from '@/components/shared/references-table-body';
import { ReviewDataFooter } from '@/components/shared/references-table-footer';
import { TableBottomHeader } from '@/components/shared/references-table-bottom-header';
import { PDFDialog } from '@/components/review-full-text-screening/pdf-dialog';
import { useFetchReview } from '@/hooks/use-review';

export const Route = createFileRoute('/reviews/$reviewId/review-data')({
  component: RouteComponent,
});

function RouteComponent() {
  const reviewId = Number(Route.useParams().reviewId);
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);
  const queryClient = useQueryClient();

  useEffect(() => {
    setPageTitle('Review Data');
    setIsAuthenticated(true);
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
    useState<ArticleViewLayout>('title-only');

  // Resolve duplicates dialog
  const [isResolveDuplicatesOpen, setIsResolveDuplicatesOpen] = useState(false);

  // Fetch data
  const queryParams = {
    review: reviewId,
    ...filters.filters,
  };

  const { data, isLoading, error } = useFetchReviewData(queryParams);
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
    () => {
      queryClient.invalidateQueries({
        queryKey: ['reviews', 'review-data', queryParams],
      });
    },
    ui.selectedReferenceIds,
    ui.highlightedReferenceId,
    ui.sortedReferences
  );

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
      {/* Dialogs */}
      {ui.openPDFId && ui.openPDFReference && ui.openPDFReference.file && (
        <PDFDialog
          reviewId={reviewId}
          referenceId={ui.openPDFId}
          open={ui.openPDFReference !== null}
          onOpenChange={ui.handleClosePDF}
          title={ui.openPDFReference.title}
          fileUrl={ui.openPDFReference.file}
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
        description="Add references to the review"
        acceptedFormats=".bib,application/x-bibtex"
        acceptedMimeTypes={['application/x-bibtex']}
        fileTypeLabel="BibTeX"
        onUpload={fileUpload.handleUploadReferences}
      />
      <FileUploadDialog
        open={fileUpload.openUploadPDFDialog}
        onOpenChange={fileUpload.setOpenUploadPDFDialog}
        onUpload={fileUpload.handleUploadPDF}
      />
      {fileUpload.openMatchDialog && (
        <MatchPDFDialog
          open={fileUpload.openMatchDialog}
          onOpenChange={fileUpload.setOpenMatchDialog}
          references={fileUpload.combinedReferences}
          uploadedPDFs={fileUpload.uploadedPDFs}
          onImport={fileUpload.handleMatch}
        />
      )}

      {/* Header */}
      <ReviewHeader reviewId={reviewId} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sources Sidebar */}
        <SourcesSidebar
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
        />

        <div className="flex flex-col flex-1">
          {/* Table Header */}
          <TableTopHeader
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
          />

          <div className="flex flex-1 overflow-hidden">
            {/* References Table */}
            <ReferencesTable viewLayout={articleViewLayout}>
              <TableBottomHeader
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
              />
              {articleViewLayout !== 'title-abstract' && (
                <ReviewDataFooter
                  reviewId={reviewId}
                  userRole={fetchReview.data?.userRole || 'Viewer'}
                  selectedReferenceIds={ui.selectedReferenceIds}
                  highlightedReferenceId={ui.highlightedReferenceId}
                  onLabelsApplied={() =>
                    queryClient.invalidateQueries({
                      queryKey: ['reviews', 'review-data', queryParams],
                    })
                  }
                  onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
                />
              )}
            </ReferencesTable>

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
                onLabelsApplied={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['reviews', 'review-data', queryParams],
                  })
                }
                onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
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
                const allAssigneeIds = (data?.assignees || []).map((a) => a.Id);
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
              onDeleteLabel={async () => true}
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
          onLabelsApplied={() =>
            queryClient.invalidateQueries({
              queryKey: ['reviews', 'review-data', queryParams],
            })
          }
          onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
        />
      )}
    </div>
  );
}
