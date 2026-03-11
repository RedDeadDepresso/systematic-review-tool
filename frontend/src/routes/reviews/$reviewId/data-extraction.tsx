import { DataExtractionTable } from '@/features/extraction/components/data-extraction/data-extraction-table';
import { PDFDialog } from '@/components/blocks/pdf-dialog/pdf-dialog';
import { FileUploadDialog } from '@/components/blocks/file-upload-dialog';
import { MatchPDFDialog } from '@/features/references/components/uploaded-pdfs/match-pdf-dialog';
import { ExtractionFooter } from '@/features/references/components/references/references-table-footer';
import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchExtractionQuestions } from '@/features/extraction/hooks/use-extraction-questions';
import { useFileUpload } from '@/features/references/hooks/use-reference-file-upload';
import { useReferenceUI } from '@/features/references/hooks/use-reference-ui';
import { useReferenceFilters } from '@/features/references/hooks/use-reference-filters';
import { useFetchReview } from '@/features/reviews/hooks/use-reviews';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect, useCallback, useState, useRef } from 'react';
import { SavedPDFDialog } from '@/features/references/components/uploaded-pdfs/saved-pdf-dialog';
import { ExtractionReferenceDrawer } from '@/features/references/components/references/reference-drawer';
import { FiltersSidebar } from '@/features/references/components/references/filters-sidebar';
import {
  useFetchReferences,
  useFetchFilterCounts,
  selectFlatReferences,
  selectPageMeta,
  referenceKeys,
} from '@/features/references/hooks/use-references';
import { useDeleteLabel } from '@/features/references/hooks/use-labels';
import { useKeywordManagement } from '@/features/references/hooks/use-keyword-management';
import {
  ENDPOINTS,
  exportExtraction,
  type LabelCount,
} from '@/features/references/api/references';
import type { ExportType } from '@/features/references/components/references/references-table-top-header';
import type { ReferenceWithAnswers } from '@/features/extraction/types/extraction';

export const Route = createFileRoute('/reviews/$reviewId/data-extraction')({
  component: RouteComponent,
});

function RouteComponent() {
  const reviewId = Number(Route.useParams().reviewId);
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);
  const fetchReview = useFetchReview(reviewId);
  const userRole = fetchReview.data?.userRole ?? 'viewer';
  const queryClient = useQueryClient();

  useEffect(() => {
    setPageTitle('Data Extraction');
    setIsAuthenticated(true);
    setScroll(false);
  }, []);

  // ── Filters ───────────────────────────────────────────────────────────────
  const filters = useReferenceFilters({
    enableOpinions: false,
    enableSearchMethods: false,
    enableKeywords: true,
    enableLabels: true,
    enablePublicationFilters: true,
    enableFileStatus: true,
    enableAssignees: true,
    enableDuplicates: false,
    enableExtractionStatus: true,
    debounceDelay: 1500,
  });

  // ── Data fetching ─────────────────────────────────────────────────────────
  const queryParams = { review: reviewId, ...filters.filters, limit: 50 };
  const referencesQuery = useFetchReferences<ReferenceWithAnswers>(
    queryParams,
    ENDPOINTS.extraction
  );
  const references = selectFlatReferences(referencesQuery.data);
  const { totalCount, filteredCount } = selectPageMeta(referencesQuery.data);

  // Filter counts always unfiltered — provides counts for the status dropdown
  const { data: filterCounts } = useFetchFilterCounts(
    reviewId,
    ENDPOINTS.extraction
  );
  const { data: questionsData } = useFetchExtractionQuestions({ reviewId });

  // ── Cache invalidation ────────────────────────────────────────────────────
  const invalidateQuery = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ['reviews', reviewId, ENDPOINTS.extraction],
    });
    queryClient.invalidateQueries({
      queryKey: referenceKeys.filterCounts(reviewId, ENDPOINTS.extraction),
    });
  }, [queryClient, reviewId]);

  // ── Sub-hooks ─────────────────────────────────────────────────────────────
  const ui = useReferenceUI(references, fetchReview.data?.userMemberId);

  const deleteLabel = useDeleteLabel();
  const handleDeleteLabel = useCallback(
    (label: LabelCount) =>
      deleteLabel.mutate(label.id, { onSuccess: invalidateQuery }),
    [deleteLabel, invalidateQuery]
  );

  const [includeHighlightEnabled, setIncludeHighlightEnabled] = useState(false);
  const [excludeHighlightEnabled, setExcludeHighlightEnabled] = useState(false);

  const keywords = useKeywordManagement(
    reviewId,
    includeHighlightEnabled,
    excludeHighlightEnabled,
    filters.includeKeywords,
    filters.excludeKeywords,
    (kws) => filters.setIncludeKeywords(kws),
    (kws) => filters.setExcludeKeywords(kws)
  );

  const fileUpload = useFileUpload(
    reviewId,
    invalidateQuery,
    ui.selectedReferenceIds,
    ui.highlightedReferenceId,
    ui.references
  );
  const isPDFExtractionSuccess = useRef(false);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = useCallback(
    (type: ExportType) => {
      const filename = `review-${reviewId}-extraction${type === 'filtered' ? '-filtered' : ''}.bib`;
      type === 'all'
        ? exportExtraction(filename, { review: reviewId })
        : exportExtraction(filename, queryParams);
    },
    [reviewId, queryParams]
  );

  if (referencesQuery.isError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-destructive">Error loading references</div>
      </div>
    );
  }

  return (
    <>
      {/* PDF Dialog */}
      {ui.openPDFId && ui.openPDFReference?.file && (
        <PDFDialog
          reviewId={reviewId}
          referenceId={ui.openPDFId}
          open
          onOpenChange={(open) => {
            ui.handleClosePDF();
            if (!open && isPDFExtractionSuccess.current) {
              isPDFExtractionSuccess.current = false;
              invalidateQuery();
            }
          }}
          title={ui.openPDFReference.title}
          fileUrl={ui.openPDFReference.file}
          readOnly={false}
          userRole={userRole}
          hasNext={ui.hasOpenPDFReferenceNext}
          hasPrev={ui.hasOpenPDFReferencePrev}
          onNavigate={(direction) => {
            ui.handleOpenPDFNavigate(direction);
            if (isPDFExtractionSuccess.current) {
              isPDFExtractionSuccess.current = false;
              invalidateQuery();
            }
          }}
          onExtractionSuccess={() => (isPDFExtractionSuccess.current = true)}
        />
      )}

      {/* File upload dialogs */}
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
      {fileUpload.openSavedPDFDialog && (
        <SavedPDFDialog
          reviewId={reviewId}
          open={fileUpload.openSavedPDFDialog}
          onOpenChange={fileUpload.setopenSavedPDFDialog}
        />
      )}

      <div className="h-full flex overflow-hidden bg-background">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <DataExtractionTable
            reviewId={reviewId}
            userRole={userRole}
            questions={questionsData ?? []}
            references={references}
            isLoading={referencesQuery.isLoading}
            isFetchingNextPage={referencesQuery.isFetchingNextPage}
            hasNextPage={referencesQuery.hasNextPage}
            onLoadMore={referencesQuery.fetchNextPage}
            totalCount={totalCount}
            filteredCount={filteredCount}
            selectedReferenceIds={ui.selectedReferenceIds}
            highlightedReferenceId={ui.highlightedReferenceId}
            highlightIncludeKeywords={keywords.highlightIncludeKeywords}
            highlightExcludeKeywords={keywords.highlightExcludeKeywords}
            allSelected={ui.allSelected}
            onSelectAll={ui.handleSelectAllReferences}
            onSelectReference={ui.handleReferenceSelect}
            onHighlightReference={ui.handleHighlightReference}
            onOpenDetail={ui.handleOpenDetail}
            onOpenPDF={ui.handleOpenPDF}
            onAttachPDF={(refId) => {
              ui.handleHighlightReference(refId);
              fileUpload.setOpenUploadPDFDialog(true);
            }}
            onInvalidate={invalidateQuery}
            onExport={handleExport}
            // Filters toolbar
            activeFilterCount={filters.activeFilterCount}
            ordering={filters.ordering}
            onOrderingChange={filters.handleOrderingChange}
            isFiltersSidebarCollapsed={ui.isFiltersSidebarCollapsed}
            onToggleFiltersSidebar={() =>
              ui.setIsFiltersSidebarCollapsed(!ui.isFiltersSidebarCollapsed)
            }
            // Server-side extraction status filter
            extractionStatusFilter={filters.isExtractionCompleted}
            onExtractionStatusFilterChange={filters.setIsExtractionCompleted}
            // Counts from filterCounts (unfiltered, stable)
            completedCount={filterCounts?.completedCount ?? 0}
            inProgressCount={filterCounts?.inProgressCount ?? 0}
          />

          <ExtractionFooter
            reviewId={reviewId}
            userRole={userRole}
            selectedReferenceIds={ui.selectedReferenceIds}
            highlightedReferenceId={ui.highlightedReferenceId}
            onLabelsApplied={invalidateQuery}
            onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
            onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
            onSavedPDF={() => fileUpload.setopenSavedPDFDialog(true)}
          />
        </div>

        {/* Filters sidebar */}
        <FiltersSidebar
          reviewId={reviewId}
          userRole={userRole}
          includeKeywords={keywords.includeKeywords}
          excludeKeywords={keywords.excludeKeywords}
          labels={filterCounts?.labels ?? []}
          publicationTypes={filterCounts?.publicationTypes ?? []}
          publicationYears={filterCounts?.publicationYears ?? []}
          fileCounts={
            filterCounts?.fileCounts ?? { withFile: 0, withoutFile: 0 }
          }
          assignees={filterCounts?.assignees ?? []}
          searchMethods={[]}
          opinionStatuses={[]}
          selectedOpinionStatuses={[]}
          selectedIncludeKeywords={filters.includeKeywords}
          selectedExcludeKeywords={filters.excludeKeywords}
          selectedLabels={filters.labelIds}
          selectedPublicationTypes={filters.publicationTypes}
          selectedPublicationYears={filters.publicationYears}
          selectedFileStatus={filters.fileStatus}
          selectedAssignees={filters.assigneeIds}
          selectedSearchMethods={[]}
          onIncludeKeywordToggle={filters.handleIncludeKeywordToggle}
          onExcludeKeywordToggle={filters.handleExcludeKeywordToggle}
          onOpionStatusToggle={() => {}}
          onSelectAllOpinionStatuses={() => {}}
          onSelectAllInclude={() =>
            filters.handleSelectAllIncludeKeywords(
              keywords.includeKeywords.map((k) => k.name)
            )
          }
          onSelectAllExclude={() =>
            filters.handleSelectAllExcludeKeywords(
              keywords.excludeKeywords.map((k) => k.name)
            )
          }
          onLabelToggle={filters.handleLabelToggle}
          onSelectAllLabels={() =>
            filters.handleSelectAllLabels(
              (filterCounts?.labels ?? []).map((l) => l.id)
            )
          }
          onPublicationTypeToggle={filters.handlePublicationTypeToggle}
          onSelectAllPublicationTypes={() =>
            filters.handleSelectAllPublicationTypes(
              (filterCounts?.publicationTypes ?? []).map(
                (pt) => pt.publicationType
              )
            )
          }
          onPublicationYearToggle={filters.handlePublicationYearToggle}
          onSelectAllPublicationYears={() =>
            filters.handleSelectAllPublicationYears(
              (filterCounts?.publicationYears ?? []).map((py) => py.year)
            )
          }
          onFileStatusChange={filters.handleFileStatusChange}
          onAssigneeToggle={filters.handleAssigneeToggle}
          onSelectAllAssignees={() =>
            filters.handleSelectAllAssignees(
              (filterCounts?.assignees ?? []).map((a) => a.Id)
            )
          }
          onSearchMethodToggle={() => {}}
          onSelectAllSearchMethods={() => {}}
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
          onDeleteSearchMethod={() => {}}
          articleViewLayout="title-only"
          onArticleViewLayoutChange={() => {}}
        />
      </div>

      {/* Reference drawer — opens on title click */}
      {ui.openDetail && (
        <ExtractionReferenceDrawer
          reviewId={reviewId}
          userRole={userRole}
          reference={ui.openDetail}
          onClose={ui.handleCloseDetail}
          onNavigate={ui.handleNavigateDetail}
          hasPrev={ui.currentDetailIndex > 0}
          hasNext={ui.currentDetailIndex < ui.references.length - 1}
          highlightIncludeKeywords={keywords.highlightIncludeKeywords}
          highlightExcludeKeywords={keywords.highlightExcludeKeywords}
          selectedReferenceIds={ui.selectedReferenceIds}
          highlightedReferenceId={ui.highlightedReferenceId}
          onLabelsApplied={invalidateQuery}
          onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
          onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
          onSavedPDF={() => fileUpload.setopenSavedPDFDialog(true)}
          onOpenPDF={ui.handleOpenPDF}
        />
      )}
    </>
  );
}
