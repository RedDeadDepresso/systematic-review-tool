import { DataExtractionTable } from '@/components/review-data-extraction/data-extraction-table';
import { PDFDialog } from '@/components/review-full-text-screening/pdf-dialog';
import { FileUploadDialog } from '@/components/shared/file-upload-dialog';
import { MatchPDFDialog } from '@/components/shared/match-pdf-dialog';
import { ExtractionFooter } from '@/components/shared/references-table-footer';
import { ReviewHeader } from '@/components/shared/review-header';
import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchExtractionTableData } from '@/hooks/use-extraction-table';
import { useFileUpload } from '@/hooks/use-reference-file-upload';
import { useReferenceUI } from '@/hooks/use-reference-ui';
import { useFetchReview } from '@/hooks/use-review';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';

export const Route = createFileRoute('/reviews/$reviewId/data-extraction')({
  component: RouteComponent,
});

function RouteComponent() {
  const reviewId = Number(Route.useParams().reviewId);
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);
  const fetchReview = useFetchReview(reviewId);
  const { data } = useFetchExtractionTableData(reviewId);
  const queryClient = useQueryClient();

  // UI state management
  const ui = useReferenceUI(data?.references || []);

  // File upload management
  const fileUpload = useFileUpload(
    reviewId,
    () => {
      queryClient.invalidateQueries({
        queryKey: ['extraction-table', reviewId],
      });
    },
    ui.selectedReferenceIds,
    ui.highlightedReferenceId,
    ui.sortedReferences
  );

  useEffect(() => {
    setPageTitle('Data Extraction');
    setIsAuthenticated(true);
  }, []);

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
      <ReviewHeader reviewId={reviewId} />
      <DataExtractionTable
        reviewId={reviewId}
        references={ui.sortedReferences}
        questions={data?.questions || []}
        selectedReferenceIds={ui.selectedReferenceIds}
        highlightedReferenceId={ui.highlightedReferenceId}
        allSelected={ui.allSelected}
        onSelectAll={ui.handleSelectAllReferences}
        onSelectReference={ui.handleReferenceSelect}
        onHighlightReference={ui.handleHighlightReference}
        onOpenDetail={ui.handleOpenDetail}
        onOpenPDF={ui.handleOpenPDF}
        onAttachPDF={(refId: number) => {
          ui.handleHighlightReference(refId);
          fileUpload.setOpenUploadPDFDialog(true);
        }}
      />
      <ExtractionFooter
        reviewId={reviewId}
        userRole={fetchReview.data?.userRole || 'Viewer'}
        selectedReferenceIds={ui.selectedReferenceIds}
        highlightedReferenceId={ui.highlightedReferenceId}
        onLabelsApplied={() =>
          queryClient.invalidateQueries({
            queryKey: ['extraction-table', reviewId],
          })
        }
        onAttachPDF={() => fileUpload.setOpenUploadPDFDialog(true)}
      />
    </div>
  );
}
