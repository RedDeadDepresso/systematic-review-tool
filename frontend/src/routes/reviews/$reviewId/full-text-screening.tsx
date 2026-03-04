import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ReferenceTableLayout } from '@/features/references/components/references/reference-table-layout';
import { useScreeningPage } from '@/features/references/hooks/use-screening-page';
import { useReferenceFilters } from '@/features/references/hooks/use-reference-filters';
import { ScreeningReferenceDetailPanel } from '@/features/references/components/references/reference-panel';
import { ScreeningReferenceDrawer } from '@/features/references/components/references/reference-drawer';
import { ScreeningFooter } from '@/features/references/components/references/references-table-footer';
import { AddDataDialog } from '@/components/blocks/add-data-dialog';
import {
  useFetchReferences,
  useFetchFilterCounts,
  selectFlatReferences,
  selectPageMeta,
} from '@/features/references/hooks/use-references';
import {
  ENDPOINTS,
  exportScreeningFullText,
} from '@/features/references/api/references';

export const Route = createFileRoute('/reviews/$reviewId/full-text-screening')({
  component: RouteComponent,
});

function RouteComponent() {
  const reviewId = Number(Route.useParams().reviewId);
  const [openAddData, setOpenAddData] = useState(false);

  const filters = useReferenceFilters({
    enableOpinions: true,
    enableSearchMethods: false,
    enableKeywords: true,
    enableLabels: true,
    enablePublicationFilters: true,
    enableFileStatus: true,
    enableAssignees: true,
    enableDuplicates: false,
    debounceDelay: 1500,
  });

  const queryParams = {
    review: reviewId,
    ...filters.filters,
    limit: 50,
  };

  // Paginated references — scoped to current filters
  const referencesQuery = useFetchReferences(
    queryParams,
    ENDPOINTS.screeningFullText
  );
  const references = selectFlatReferences(referencesQuery.data);
  const { totalCount, filteredCount } = selectPageMeta(referencesQuery.data);

  // Filter counts — always unfiltered, fetched once per reviewId
  const { data: filterCounts } = useFetchFilterCounts(
    reviewId,
    ENDPOINTS.screeningFullText
  );

  const page = useScreeningPage(
    reviewId,
    {
      pageTitle: 'Full Text Screening',
      defaultLayout: 'title-file',
      opinionStage: 'full-text',
      endpoint: ENDPOINTS.screeningFullText,
      exportFilename: (id, filtered) =>
        `review-${id}-screening-full-text${filtered ? '-filtered' : ''}.bib`,
    },
    filters,
    references
  );

  if (referencesQuery.isError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-destructive">Error loading references</div>
      </div>
    );
  }

  const { ui, fileUpload, keywords, userRole } = page;
  const highlightedRef =
    references.find((r) => r.id === ui.highlightedReferenceId) ?? null;

  const screeningFooter = (
    <ScreeningFooter
      reviewId={reviewId}
      userRole={userRole}
      selectedReferenceIds={ui.selectedReferenceIds}
      highlightedReferenceId={ui.highlightedReferenceId}
      onLabelsApplied={page.invalidateQuery}
      onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
      onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
      onSavedPDF={() => fileUpload.setopenSavedPDFDialog(true)}
      onOpinionApplied={page.handleOpinionApplied}
    />
  );

  return (
    <ReferenceTableLayout
      reviewId={reviewId}
      userRole={userRole}
      totalCount={totalCount}
      filteredCount={filteredCount}
      isLoading={referencesQuery.isLoading}
      isFetchingNextPage={referencesQuery.isFetchingNextPage}
      hasNextPage={referencesQuery.hasNextPage}
      onLoadMore={referencesQuery.fetchNextPage}
      // All sidebar counts come from filterCounts, never from firstPage
      searchMethods={filterCounts?.searchMethods ?? []}
      labels={filterCounts?.labels ?? []}
      publicationTypes={filterCounts?.publicationTypes ?? []}
      publicationYears={filterCounts?.publicationYears ?? []}
      fileCounts={filterCounts?.fileCounts ?? { withFile: 0, withoutFile: 0 }}
      assignees={filterCounts?.assignees ?? []}
      opinionStatuses={filters.ALL_OPINION_STATUSES}
      ui={ui}
      fileUpload={fileUpload}
      keywords={keywords}
      filters={filters}
      articleViewLayout={page.articleViewLayout}
      setArticleViewLayout={page.setArticleViewLayout}
      includeHighlightEnabled={page.includeHighlightEnabled}
      setIncludeHighlightEnabled={page.setIncludeHighlightEnabled}
      excludeHighlightEnabled={page.excludeHighlightEnabled}
      setExcludeHighlightEnabled={page.setExcludeHighlightEnabled}
      onDeleteLabel={page.handleDeleteLabel}
      onDeleteSearchMethod={page.handleDeleteSearchMethod}
      onExport={(type) =>
        page.handleExport(type, exportScreeningFullText, queryParams)
      }
      breakButtonReviewId={reviewId}
      onAddData={() => setOpenAddData(true)}
      extraDialogs={
        <AddDataDialog
          reviewId={reviewId}
          open={openAddData}
          dataSources={['screening']}
          dataSink="full-text"
          onOpenChange={setOpenAddData}
          onAdd={page.invalidateQuery}
        />
      }
      pdfDialogFooter={
        <ScreeningFooter
          reviewId={reviewId}
          userRole={userRole}
          selectedReferenceIds={[]}
          highlightedReferenceId={ui.openPDFId}
          onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
          onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
          onSavedPDF={() => fileUpload.setopenSavedPDFDialog(true)}
          onOpinionApplied={page.handleOpinionApplied}
          opinionStatus={ui.PDFOpinionStatus}
        />
      }
      footer={screeningFooter}
      detailPanel={
        <ScreeningReferenceDetailPanel
          reviewId={reviewId}
          userRole={userRole}
          reference={highlightedRef}
          onClose={() => ui.handleHighlightReference(null)}
          selectedReferenceIds={ui.selectedReferenceIds}
          highlightedReferenceId={ui.highlightedReferenceId}
          highlightIncludeKeywords={keywords.highlightIncludeKeywords}
          highlightExcludeKeywords={keywords.highlightExcludeKeywords}
          onLabelsApplied={page.invalidateQuery}
          onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
          onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
          onSavedPDF={() => fileUpload.setopenSavedPDFDialog(true)}
          onOpenPDF={ui.handleOpenPDF}
          onOpinionApplied={page.handleOpinionApplied}
        />
      }
      drawer={
        ui.openDetail && (
          <ScreeningReferenceDrawer
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
            onLabelsApplied={page.invalidateQuery}
            onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
            onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
            onSavedPDF={() => fileUpload.setopenSavedPDFDialog(true)}
            onOpenPDF={ui.handleOpenPDF}
            onOpinionApplied={page.handleOpinionApplied}
          />
        )
      }
    />
  );
}
