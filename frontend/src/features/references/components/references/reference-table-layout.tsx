/**
 * ReferenceTableLayout
 *
 * Single shell component used by Review Data, Screening, and Full-Text
 * Screening. Route-specific content is passed via render-prop slots
 * (footer, detailPanel, drawer, extraDialogs) so this file never needs
 * to import route-specific components.
 */
import { cn } from '@/lib/utils';
import { ReferencesTable } from '@/features/references/components/references/references-table';
import { ReferencesTableBody } from '@/features/references/components/references/references-table-body';
import { TableSubHeader } from '@/features/references/components/references/references-table-sub-header';
import {
  TableTopHeader,
  type ExportType,
} from '@/features/references/components/references/references-table-top-header';
import { FiltersSidebar } from '@/features/references/components/references/filters-sidebar';
import { SourcesSidebar } from '@/features/references/components/references/sources-sidebar';
import { FileUploadDialog } from '@/components/blocks/file-upload-dialog';
import { MatchPDFDialog } from '@/features/references/components/uploaded-pdfs/match-pdf-dialog';
import { SavedPDFDialog } from '@/features/references/components/uploaded-pdfs/saved-pdf-dialog';
import { PDFDialog } from '@/components/blocks/pdf-dialog/pdf-dialog';
import type {
  ArticleViewLayout,
  OpinionStatus,
} from '@/features/references/types/references';
import type {
  Assignee,
  DuplicateStatusCounts,
  FileCounts,
  LabelCount,
  OrderingField,
  PublicationType,
  PublicationYear,
  SearchMethod,
} from '@/features/references/api/references';
import type { ReviewRole } from '@/features/reviews/types/reviews';
import type { useReferenceUI } from '@/features/references/hooks/use-reference-ui';
import type { useFileUpload } from '@/features/references/hooks/use-reference-file-upload';
import type { useKeywordManagement } from '@/features/references/hooks/use-keyword-management';
import type React from 'react';

// ── Nested config types ────────────────────────────────────────────────────────

interface SourcesSidebarConfig {
  onAddReferences: () => void;
  onDetectDuplicates: () => void;
  onResolveDuplicates: () => void;
  duplicateStatusCounts: DuplicateStatusCounts;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ReferenceTableLayoutProps {
  reviewId: number;
  userRole: ReviewRole;

  totalCount: number;
  filteredCount: number;
  isLoading: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;

  // Sidebar aggregation
  searchMethods: SearchMethod[];
  labels: LabelCount[];
  publicationTypes: PublicationType[];
  publicationYears: PublicationYear[];
  fileCounts: FileCounts;
  assignees: Assignee[];
  /** ALL_OPINION_STATUSES for screening routes; [] for review-data */
  opinionStatuses: OpinionStatus[];

  // Sub-hooks
  ui: ReturnType<typeof useReferenceUI>;
  fileUpload: ReturnType<typeof useFileUpload>;
  keywords: ReturnType<typeof useKeywordManagement>;

  // Filters (subset of useReferenceFilters return value)
  filters: {
    activeFilterCount: number;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    ordering: OrderingField;
    handleOrderingChange: (o: OrderingField) => void;
    searchMethodIds: number[];
    handleSearchMethodToggle: (id: number) => void;
    setSearchMethodIds: (ids: number[]) => void;
    duplicateStatuses: string[];
    handleDuplicateStatusToggle: (s: string) => void;
    includeKeywords: string[];
    excludeKeywords: string[];
    handleIncludeKeywordToggle: (k: string) => void;
    handleExcludeKeywordToggle: (k: string) => void;
    handleSelectAllIncludeKeywords: (all: string[]) => void;
    handleSelectAllExcludeKeywords: (all: string[]) => void;
    labelIds: number[];
    handleLabelToggle: (id: number) => void;
    handleSelectAllLabels: (all: number[]) => void;
    publicationTypes: string[];
    handlePublicationTypeToggle: (t: string) => void;
    handleSelectAllPublicationTypes: (all: string[]) => void;
    publicationYears: number[];
    handlePublicationYearToggle: (y: number) => void;
    handleSelectAllPublicationYears: (all: number[]) => void;
    fileStatus: 'all' | 'withFile' | 'withoutFile';
    handleFileStatusChange: (s: 'all' | 'withFile' | 'withoutFile') => void;
    assigneeIds: (number | null)[];
    handleAssigneeToggle: (id: number | null) => void;
    handleSelectAllAssignees: (all: (number | null)[]) => void;
    opinionStatuses: OpinionStatus[];
    handleOpinionStatusToggle: (s: OpinionStatus) => void;
    handleSelectAllOpinionStatuses: (all: OpinionStatus[]) => void;
    ALL_OPINION_STATUSES: OpinionStatus[];
    handleResetAllFilters: () => void;
    handleSelectAllSearchMethods: (all: number[]) => void;
  };

  // Layout state
  articleViewLayout: ArticleViewLayout;
  setArticleViewLayout: (l: ArticleViewLayout) => void;
  includeHighlightEnabled: boolean;
  setIncludeHighlightEnabled: (v: boolean) => void;
  excludeHighlightEnabled: boolean;
  setExcludeHighlightEnabled: (v: boolean) => void;

  // Delete handlers
  onDeleteLabel: (l: LabelCount) => void;
  onDeleteSearchMethod: (sm: SearchMethod) => void;
  onExport: (type: ExportType) => void;

  // Render slots
  footer: React.ReactNode;
  detailPanel: React.ReactNode;
  drawer: React.ReactNode;
  extraDialogs?: React.ReactNode;
  pdfDialogFooter?: React.ReactNode;

  // Optional features
  /** Pass to enable the sources sidebar (Review Data only) */
  sourcesSidebar?: SourcesSidebarConfig;
  breakButtonReviewId?: number;
  onAddData?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReferenceTableLayout({
  reviewId,
  userRole,
  totalCount,
  filteredCount,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  searchMethods,
  labels,
  publicationTypes,
  publicationYears,
  fileCounts,
  assignees,
  opinionStatuses,
  ui,
  fileUpload,
  keywords,
  filters,
  articleViewLayout,
  setArticleViewLayout,
  includeHighlightEnabled,
  setIncludeHighlightEnabled,
  excludeHighlightEnabled,
  setExcludeHighlightEnabled,
  onDeleteLabel,
  onDeleteSearchMethod,
  onExport,
  footer,
  detailPanel,
  drawer,
  extraDialogs,
  pdfDialogFooter,
  sourcesSidebar,
  breakButtonReviewId,
  onAddData,
}: ReferenceTableLayoutProps) {
  return (
    <>
      {/* PDF dialog */}
      {ui.openPDFId && ui.openPDFReference?.file && (
        <PDFDialog
          reviewId={reviewId}
          referenceId={ui.openPDFId}
          open
          onOpenChange={ui.handleClosePDF}
          title={ui.openPDFReference.title}
          fileUrl={ui.openPDFReference.file}
          userRole={userRole}
          hasNext={ui.hasOpenPDFReferenceNext}
          hasPrev={ui.hasOpenPDFReferencePrev}
          onNavigate={ui.handleOpenPDFNavigate}
          footer={pdfDialogFooter}
        />
      )}

      {/* File upload dialogs — shared by all routes */}
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

      {/* Route-specific dialogs (ResolveDuplicates, AddDataDialog, etc.) */}
      {extraDialogs}

      {/* Page shell */}
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <div className="flex flex-1 overflow-hidden">
          {/* Sources sidebar — Review Data only */}
          {sourcesSidebar && (
            <SourcesSidebar
              reviewId={reviewId}
              searchMethods={searchMethods}
              userRole={userRole}
              selectedSearchMethodIds={filters.searchMethodIds}
              onSearchMethodToggle={filters.handleSearchMethodToggle}
              onSelectAllReferences={() => filters.setSearchMethodIds([])}
              duplicateStatusCounts={sourcesSidebar.duplicateStatusCounts}
              selectedDuplicateStatuses={filters.duplicateStatuses}
              onDuplicateStatusToggle={filters.handleDuplicateStatusToggle}
              totalReferences={totalCount}
              isCollapsed={ui.isSourcesSidebarCollapsed}
              onAddReferences={sourcesSidebar.onAddReferences}
              onDetectDuplicates={sourcesSidebar.onDetectDuplicates}
              onResolveDuplicates={sourcesSidebar.onResolveDuplicates}
              onDeleteSearchMethod={onDeleteSearchMethod}
              onToggleCollapse={() =>
                ui.setIsSourcesSidebarCollapsed(!ui.isSourcesSidebarCollapsed)
              }
            />
          )}

          <div className="flex flex-col flex-1 min-h-0">
            <TableTopHeader
              userRole={userRole}
              activeFilterCount={filters.activeFilterCount}
              filteredCount={filteredCount}
              totalCount={totalCount}
              searchQuery={filters.searchQuery}
              onSearchChange={filters.setSearchQuery}
              ordering={filters.ordering}
              onOrderingChange={filters.handleOrderingChange}
              isLeftCollapsed={
                sourcesSidebar ? ui.isSourcesSidebarCollapsed : undefined
              }
              onToggleLeftCollapse={
                sourcesSidebar
                  ? () =>
                      ui.setIsSourcesSidebarCollapsed(
                        !ui.isSourcesSidebarCollapsed
                      )
                  : undefined
              }
              isRightCollapsed={ui.isFiltersSidebarCollapsed}
              onToggleRightCollapse={() =>
                ui.setIsFiltersSidebarCollapsed(!ui.isFiltersSidebarCollapsed)
              }
              onAddData={onAddData}
              onExport={onExport}
              breakButtonReviewId={breakButtonReviewId}
            />

            <div className="flex flex-1 overflow-hidden">
              <div
                className={cn(
                  'flex flex-col min-h-0 overflow-hidden min-w-0',
                  articleViewLayout === 'title-abstract' ? 'w-80' : 'flex-1'
                )}
              >
                <ReferencesTable viewLayout={articleViewLayout}>
                  <TableSubHeader
                    allSelected={ui.allSelected}
                    onSelectAll={ui.handleSelectAllReferences}
                    ordering={filters.ordering}
                    onOrderingChange={filters.handleOrderingChange}
                    viewLayout={articleViewLayout}
                  />
                  <ReferencesTableBody
                    references={ui.references}
                    selectedReferenceIds={ui.selectedReferenceIds}
                    highlightedReferenceId={ui.highlightedReferenceId}
                    onSelectReference={ui.handleReferenceSelect}
                    onHighlightReference={ui.handleHighlightReference}
                    highlightIncludeKeywords={keywords.highlightIncludeKeywords}
                    highlightExcludeKeywords={keywords.highlightExcludeKeywords}
                    onOpenDetail={ui.handleOpenDetail}
                    onOpenPDF={ui.handleOpenPDF}
                    viewLayout={articleViewLayout}
                    onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
                    isLoading={isLoading}
                    isFetchingNextPage={isFetchingNextPage}
                    hasNextPage={hasNextPage}
                    onLoadMore={onLoadMore}
                  />
                </ReferencesTable>

                {articleViewLayout !== 'title-abstract' && footer}
              </div>

              {articleViewLayout === 'title-abstract' && detailPanel}

              <FiltersSidebar
                reviewId={reviewId}
                userRole={userRole}
                includeKeywords={keywords.includeKeywords}
                excludeKeywords={keywords.excludeKeywords}
                labels={labels}
                publicationTypes={publicationTypes}
                publicationYears={publicationYears}
                fileCounts={fileCounts}
                assignees={assignees}
                searchMethods={searchMethods}
                opinionStatuses={opinionStatuses}
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
                  filters.handleSelectAllLabels(labels.map((l) => l.id))
                }
                onPublicationTypeToggle={filters.handlePublicationTypeToggle}
                onSelectAllPublicationTypes={() =>
                  filters.handleSelectAllPublicationTypes(
                    publicationTypes.map((pt) => pt.publicationType)
                  )
                }
                onPublicationYearToggle={filters.handlePublicationYearToggle}
                onSelectAllPublicationYears={() =>
                  filters.handleSelectAllPublicationYears(
                    publicationYears.map((py) => py.year)
                  )
                }
                onFileStatusChange={filters.handleFileStatusChange}
                onAssigneeToggle={filters.handleAssigneeToggle}
                onSelectAllAssignees={() =>
                  filters.handleSelectAllAssignees(assignees.map((a) => a.Id))
                }
                onSearchMethodToggle={filters.handleSearchMethodToggle}
                onSelectAllSearchMethods={() =>
                  filters.handleSelectAllSearchMethods(
                    searchMethods.map((sm) => sm.id)
                  )
                }
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
                onDeleteLabel={onDeleteLabel}
                onDeleteSearchMethod={onDeleteSearchMethod}
                articleViewLayout={articleViewLayout}
                onArticleViewLayoutChange={setArticleViewLayout}
              />
            </div>
          </div>
        </div>

        {drawer}
      </div>
    </>
  );
}
