import { DataExtractionTable } from '@/components/review-data-extraction/data-extraction-table';
import { PDFDialog } from '@/components/shared/pdf-dialog';
import { FileUploadDialog } from '@/components/shared/file-upload-dialog';
import { MatchPDFDialog } from '@/components/shared/match-pdf-dialog';
import { ExtractionFooter } from '@/components/shared/references-table-footer';
import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchExtractionTableData } from '@/hooks/use-extraction-table';
import { useFileUpload } from '@/hooks/use-reference-file-upload';
import { useReferenceUI } from '@/hooks/use-reference-ui';
import { useFetchReview } from '@/hooks/use-review';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';
import { Spinner } from '@/components/ui/spinner';

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

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="flex flex-col gap-2">
          <span>Loading references...</span>
          <div className="flex items-center justify-center w-full">
            <Spinner />
          </div>
        </div>
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
          readOnly={false}
          userRole={fetchReview.data?.userRole || 'Viewer'}
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
        onMatchPDF={() => fileUpload.setOpenMatchDialog(true)}
      />
    </div>
  );
}
