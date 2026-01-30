import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchReviewData } from '@/hooks/use-reference';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useState, useEffect } from 'react';
import { ReviewHeader } from '@/components/shared/review-header';
import { SourcesSidebar } from '@/components/review-data/sources-sidebar';
import { ReferencesTable } from '@/components/shared/references-table';
import { FiltersSidebar } from '@/components/shared/filters-sidebar';
import { ReferenceDrawer } from '@/components/shared/reference-drawer';
import { ReferenceDetailPanel } from '@/components/shared/reference-panel';
import { TableTopHeader } from '@/components/shared/references-table-top-header';
import { ResolveDuplicatesDialog } from '@/components/shared/resolve-duplicates-dialog';
import { FileUploadDialog } from '@/components/shared/file-upload-dialog';
import { MatchPDFDialog } from '@/components/shared/match-pdf-dialog';
import type { Criteria } from '@/components/shared/screening-criteria-popover';
import type { ArticleViewLayout } from '@/types/reference';
import { useReviewDataFilters } from '@/hooks/use-reference-filters';
import { useReviewDataUI } from '@/hooks/use-reference-ui';
import { useKeywordManagement } from '@/hooks/use-keyword-management';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useQueryClient } from '@tanstack/react-query';

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
  const filters = useReviewDataFilters({
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

  // Screening criteria state
  const [screeningCriteria, setScreeningCriteria] = useState<Criteria[]>([]);

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

  // UI state management
  const ui = useReviewDataUI(data?.references || []);

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
  const fileUpload = useFileUpload(reviewId, () => {
    queryClient.invalidateQueries({
      queryKey: ['reviews', reviewId, 'review-data'],
    });
  });

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
      <ReviewHeader
        reviewId={reviewId}
        screeningCriteria={screeningCriteria}
        onScreeningCriteriaChange={setScreeningCriteria}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sources Sidebar */}
        <SourcesSidebar
          searchMethods={data?.searchMethods || []}
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
            <ReferencesTable
              reviewId={reviewId}
              references={ui.sortedReferences}
              selectedReferenceIds={ui.selectedReferenceIds}
              highlightedReferenceId={ui.highlightedReferenceId}
              onSelectReference={ui.handleReferenceSelect}
              onHighlightReference={ui.handleHighlightReference}
              onSelectAll={ui.handleSelectAllReferences}
              highlightIncludeKeywords={keywords.highlightIncludeKeywords}
              highlightExcludeKeywords={keywords.highlightExcludeKeywords}
              sortField={ui.sortField}
              sortDirection={ui.sortDirection}
              onSortChange={ui.handleSortChange}
              onOpenDetail={ui.handleOpenDetail}
              onLabelsApplied={() =>
                queryClient.invalidateQueries({
                  queryKey: ['reviews', reviewId, 'review-data'],
                })
              }
              onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
              viewLayout={articleViewLayout}
            />

            {/* Detail Panel */}
            {articleViewLayout === 'title-abstract' &&
              ui.highlightedReferenceId && (
                <ReferenceDetailPanel
                  reference={
                    data?.references.find(
                      (r) => r.id === ui.highlightedReferenceId
                    ) || null
                  }
                  onClose={() => ui.handleHighlightReference(null)}
                  highlightIncludeKeywords={keywords.highlightIncludeKeywords}
                  highlightExcludeKeywords={keywords.highlightExcludeKeywords}
                  onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
                />
              )}

            {/* Filters Sidebar */}
            <FiltersSidebar
              reviewId={reviewId}
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
        <ReferenceDrawer
          reference={ui.openDetail}
          onClose={ui.handleCloseDetail}
          onNavigate={ui.handleNavigateDetail}
          hasPrev={ui.currentDetailIndex > 0}
          hasNext={ui.currentDetailIndex < ui.sortedReferences.length - 1}
          highlightIncludeKeywords={keywords.highlightIncludeKeywords}
          highlightExcludeKeywords={keywords.highlightExcludeKeywords}
        />
      )}
    </div>
  );
}
