import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchScreening } from '@/hooks/use-reference';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useState, useEffect } from 'react';
import { ReviewHeader } from '@/components/shared/review-header';
import { ReferencesTable } from '@/components/shared/references-table';
import { FiltersSidebar } from '@/components/shared/filters-sidebar';
import { ScreeningReferenceDrawer } from '@/components/shared/reference-drawer';
import { ScreeningReferenceDetailPanel } from '@/components/shared/reference-panel';
import { TableTopHeader } from '@/components/shared/references-table-top-header';
import { ResolveDuplicatesDialog } from '@/components/shared/resolve-duplicates-dialog';
import { FileUploadDialog } from '@/components/shared/file-upload-dialog';
import { MatchPDFDialog } from '@/components/shared/match-pdf-dialog';
import type { Criteria } from '@/components/shared/screening-criteria-popover';
import type { ArticleViewLayout, OpinionStatus } from '@/types/reference';
import { useReferenceFilters } from '@/hooks/use-reference-filters';
import { useReferenceUI } from '@/hooks/use-reference-ui';
import { useKeywordManagement } from '@/hooks/use-keyword-management';
import { useFileUpload } from '@/hooks/use-reference-file-upload';
import { useQueryClient } from '@tanstack/react-query';
import { ReferencesTableBody } from '@/components/shared/references-table-body';
import { ScreeningFooter } from '@/components/shared/references-table-footer';
import { TableBottomHeader } from '@/components/shared/references-table-bottom-header';
import { useUpdateReferenceOpinion } from '@/hooks/use-reference-opinion';

export const Route = createFileRoute('/reviews/$reviewId/screening')({
  component: RouteComponent,
});

function RouteComponent() {
  const reviewId = Number(Route.useParams().reviewId);
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);
  const queryClient = useQueryClient();

  useEffect(() => {
    setPageTitle('Screening');
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

  // Screening criteria state
  const [screeningCriteria, setScreeningCriteria] = useState<Criteria[]>([]);

  // Article view layout state
  const [articleViewLayout, setArticleViewLayout] =
    useState<ArticleViewLayout>('title-abstract');

  // Resolve duplicates dialog
  const [isResolveDuplicatesOpen, setIsResolveDuplicatesOpen] = useState(false);

  // Fetch data
  const queryParams = {
    review: reviewId,
    ...filters.filters,
  };

  const { data, isLoading, error } = useFetchScreening(queryParams);

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
  const fileUpload = useFileUpload(reviewId, () => {
    queryClient.invalidateQueries({
      queryKey: ['reviews', reviewId, 'screening'],
    });
  });

  const updateReferenceOpinion = useUpdateReferenceOpinion();

  const handleOpinionApplied = async (status: OpinionStatus) => {
    try {
      const referenceIds = [
        ...ui.selectedReferenceIds,
        ...(ui.highlightedReferenceId ? [ui.highlightedReferenceId] : []),
      ];
      await updateReferenceOpinion.mutateAsync({
        payload: {
          referenceIds: referenceIds,
          status: status,
        },
      });
      queryClient.invalidateQueries({
        queryKey: ['reviews', 'screening', queryParams],
      });
      if (
        referenceIds.length === 1 &&
        referenceIds[0] === ui.highlightedReferenceId
      )
        ui.handleNavigateDetail('next');
    } catch {
      console.log('error');
    }
  };

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
                viewLayout={articleViewLayout}
              />
              {articleViewLayout === 'title-only' && (
                <ScreeningFooter
                  reviewId={reviewId}
                  selectedReferenceIds={ui.selectedReferenceIds}
                  highlightedReferenceId={ui.highlightedReferenceId}
                  onLabelsApplied={() =>
                    queryClient.invalidateQueries({
                      queryKey: ['reviews', 'screening', queryParams],
                    })
                  }
                  onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
                  onOpinionApplied={handleOpinionApplied}
                />
              )}
            </ReferencesTable>

            {/* Detail Panel */}
            {articleViewLayout === 'title-abstract' && (
              <ScreeningReferenceDetailPanel
                reviewId={reviewId}
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
                    queryKey: ['reviews', 'screening', queryParams],
                  })
                }
                onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
                onOpinionApplied={handleOpinionApplied}
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
        <ScreeningReferenceDrawer
          reviewId={reviewId}
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
              queryKey: ['reviews', 'screening', queryParams],
            })
          }
          onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
          onOpinionApplied={handleOpinionApplied}
        />
      )}
    </div>
  );
}
