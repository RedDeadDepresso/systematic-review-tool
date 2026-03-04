import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useContext, useEffect } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';

import { ReferenceTableLayout } from '@/features/references/components/references/reference-table-layout';
import { ResolveDuplicatesDialog } from '@/features/references/components/reference-clusters/resolve-duplicates-dialog';
import { FileUploadDialog } from '@/components/blocks/file-upload-dialog';
import { ReviewDataReferenceDetailPanel } from '@/features/references/components/references/reference-panel';
import { ReviewDataReferenceDrawer } from '@/features/references/components/references/reference-drawer';
import { ReviewDataFooter } from '@/features/references/components/references/references-table-footer';

import {
  useFetchReferences,
  useFetchFilterCounts,
  selectFlatReferences,
  selectPageMeta,
  referenceKeys,
} from '@/features/references/hooks/use-references';
import { useReferenceFilters } from '@/features/references/hooks/use-reference-filters';
import { useReferenceUI } from '@/features/references/hooks/use-reference-ui';
import { useKeywordManagement } from '@/features/references/hooks/use-keyword-management';
import { useFileUpload } from '@/features/references/hooks/use-reference-file-upload';
import { useDeleteSearchMethod } from '@/features/reviews/hooks/use-search-methods';
import { useDeleteLabel } from '@/features/references/hooks/use-labels';
import { useFetchReview } from '@/features/reviews/hooks/use-reviews';

import {
  ENDPOINTS,
  exportReviewData,
  type LabelCount,
  type SearchMethod,
} from '@/features/references/api/references';
import type { ArticleViewLayout } from '@/features/references/types/references';
import type { ExportType } from '@/features/references/components/references/references-table-top-header';

export const Route = createFileRoute('/reviews/$reviewId/review-data')({
  component: RouteComponent,
});

function RouteComponent() {
  const reviewId = Number(Route.useParams().reviewId);
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);
  const queryClient = useQueryClient();

  useEffect(() => {
    setPageTitle('Review Data');
    setIsAuthenticated(true);
    setScroll(false);
  }, []);

  // ── Filters ───────────────────────────────────────────────────────────────
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
    defaultOrdering: 'title',
  });

  // ── Layout & toggles ──────────────────────────────────────────────────────
  const [articleViewLayout, setArticleViewLayout] =
    useState<ArticleViewLayout>('title-only');
  const [includeHighlightEnabled, setIncludeHighlightEnabled] = useState(true);
  const [excludeHighlightEnabled, setExcludeHighlightEnabled] = useState(true);
  const [isResolveDuplicatesOpen, setIsResolveDuplicatesOpen] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const referencesQuery = useFetchReferences({
    review: reviewId,
    ...filters.filters,
    limit: 50,
  });
  const { data: filterCounts } = useFetchFilterCounts(reviewId);
  const references = selectFlatReferences(referencesQuery.data);
  const { totalCount, filteredCount } = selectPageMeta(referencesQuery.data);

  // ── Review metadata ───────────────────────────────────────────────────────
  const fetchReview = useFetchReview(reviewId);
  const userRole = fetchReview.data?.userRole ?? 'Viewer';

  // ── Cache invalidation ────────────────────────────────────────────────────
  const invalidateQuery = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ['reviews', reviewId, ENDPOINTS.reviewData],
    });
    queryClient.invalidateQueries({
      queryKey: referenceKeys.filterCounts(reviewId),
    });
  }, [queryClient, reviewId]);

  // ── Delete handlers ───────────────────────────────────────────────────────
  const deleteSearchMethod = useDeleteSearchMethod(reviewId);
  const deleteLabel = useDeleteLabel();
  const handleDeleteLabel = (label: LabelCount) =>
    deleteLabel.mutate(label.id, { onSuccess: invalidateQuery });
  const handleDeleteSearchMethod = (sm: SearchMethod) =>
    deleteSearchMethod.mutate(sm.id, { onSuccess: invalidateQuery });

  // ── Sub-hooks ─────────────────────────────────────────────────────────────
  const ui = useReferenceUI(references);
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

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = (exportType: ExportType) => {
    const filename = `review-${reviewId}-review-data${exportType === 'all' ? '' : '-filtered'}.bib`;
    exportType === 'all'
      ? exportReviewData(filename)
      : exportReviewData(filename, { review: reviewId, ...filters.filters });
  };

  if (referencesQuery.isError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-destructive">Error loading references</div>
      </div>
    );
  }

  const highlightedRef =
    references.find((r) => r.id === ui.highlightedReferenceId) ?? null;

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
      searchMethods={filterCounts?.searchMethods ?? []}
      labels={filterCounts?.labels ?? []}
      publicationTypes={filterCounts?.publicationTypes ?? []}
      publicationYears={filterCounts?.publicationYears ?? []}
      fileCounts={filterCounts?.fileCounts ?? { withFile: 0, withoutFile: 0 }}
      assignees={filterCounts?.assignees ?? []}
      opinionStatuses={[]}
      ui={ui}
      fileUpload={fileUpload}
      keywords={keywords}
      filters={filters}
      articleViewLayout={articleViewLayout}
      setArticleViewLayout={setArticleViewLayout}
      includeHighlightEnabled={includeHighlightEnabled}
      setIncludeHighlightEnabled={setIncludeHighlightEnabled}
      excludeHighlightEnabled={excludeHighlightEnabled}
      setExcludeHighlightEnabled={setExcludeHighlightEnabled}
      onDeleteLabel={handleDeleteLabel}
      onDeleteSearchMethod={handleDeleteSearchMethod}
      onExport={handleExport}
      sourcesSidebar={{
        duplicateStatusCounts: filterCounts?.duplicateStatusCounts ?? {
          Unresolved: 0,
          Deleted: 0,
          'Not Duplicate': 0,
          Resolved: 0,
        },
        onAddReferences: () => fileUpload.setOpenUploadBibDialog(true),
        onDetectDuplicates: () =>
          fileUpload.detectDuplicateReferences.mutate({ reviewId }),
        onResolveDuplicates: () => setIsResolveDuplicatesOpen(true),
      }}
      extraDialogs={
        <>
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
        </>
      }
      footer={
        <ReviewDataFooter
          reviewId={reviewId}
          userRole={userRole}
          selectedReferenceIds={ui.selectedReferenceIds}
          highlightedReferenceId={ui.highlightedReferenceId}
          onLabelsApplied={invalidateQuery}
          onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
          onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
          onSavedPDF={() => fileUpload.setopenSavedPDFDialog(true)}
        />
      }
      detailPanel={
        <ReviewDataReferenceDetailPanel
          reviewId={reviewId}
          userRole={userRole}
          reference={highlightedRef}
          onClose={() => ui.handleHighlightReference(null)}
          selectedReferenceIds={ui.selectedReferenceIds}
          highlightedReferenceId={ui.highlightedReferenceId}
          highlightIncludeKeywords={keywords.highlightIncludeKeywords}
          highlightExcludeKeywords={keywords.highlightExcludeKeywords}
          onLabelsApplied={invalidateQuery}
          onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
          onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
          onOpenPDF={ui.handleOpenPDF}
          onSavedPDF={() => fileUpload.setopenSavedPDFDialog(true)}
        />
      }
      drawer={
        ui.openDetail && (
          <ReviewDataReferenceDrawer
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
            onOpenPDF={ui.handleOpenPDF}
            onSavedPDF={() => fileUpload.setopenSavedPDFDialog(true)}
          />
        )
      }
    />
  );
}
