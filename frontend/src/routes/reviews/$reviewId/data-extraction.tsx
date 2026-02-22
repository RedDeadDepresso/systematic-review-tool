import { DataExtractionTable } from '@/features/extraction/components/data-extraction/data-extraction-table';
import { PDFDialog } from '@/components/blocks/pdf-dialog/pdf-dialog';
import { FileUploadDialog } from '@/components/blocks/file-upload-dialog';
import { MatchPDFDialog } from '@/features/references/components/uploaded-pdfs/match-pdf-dialog';
import { ExtractionFooter } from '@/features/references/components/references/references-table-footer';
import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchExtractionTableData } from '@/features/extraction/hooks/use-extraction-table';
import { useFileUpload } from '@/features/references/hooks/use-reference-file-upload';
import { useReferenceUI } from '@/features/references/hooks/use-reference-ui';
import { useFetchReview } from '@/features/reviews/hooks/use-reviews';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';

export const Route = createFileRoute('/reviews/$reviewId/data-extraction')({
  component: RouteComponent,
});

function RouteComponent() {
  const reviewId = Number(Route.useParams().reviewId);
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);
  const fetchReview = useFetchReview(reviewId);
  const { data, isLoading, error } = useFetchExtractionTableData(reviewId);
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
    setScroll(false);
  }, []);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-destructive">Error loading references</div>
      </div>
    );
  }

  return (
    <>
      {ui.openPDFId && ui.openPDFReference && ui.openPDFReference.file && (
        <PDFDialog
          reviewId={reviewId}
          referenceId={ui.openPDFId}
          open={ui.openPDFReference !== null}
          onOpenChange={ui.handleClosePDF}
          title={ui.openPDFReference.title}
          fileUrl={ui.openPDFReference.file}
          readOnly={false}
          userRole={fetchReview.data?.userRole || 'Viewer'}
          hasNext={ui.hasOpenPDFReferenceNext}
          hasPrev={ui.hasOpenPDFReferencePrev}
          onNavigate={ui.handleOpenPDFNavigate}
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
        />
      )}
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <DataExtractionTable
          reviewId={reviewId}
          references={ui.sortedReferences}
          questions={data?.questions || []}
          isLoading={isLoading}
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
          onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
        />
      </div>
    </>
  );
}
