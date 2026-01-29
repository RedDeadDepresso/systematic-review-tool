import { useUpdateReview, useFetchReview } from '@/hooks/use-review';
import { Button } from '../ui/button';
import { Eye, FileSymlink, FileText, Filter, Upload } from 'lucide-react';
import { Spinner } from '../ui/spinner';
import { FileUploadDialog } from '../shared/file-upload-dialog';
import { useState } from 'react';
import { useFetchUploadedPDFs, useUploadPDF } from '@/hooks/use-uploaded-pdf';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { MatchPDFDialog } from '../shared/match-pdf-dialog';
import type { Reference, ReferencePDFMapping } from '@/types/reference';
import { useAttachPDFsToReferences } from '@/hooks/use-reference';
import { ReviewHeader } from '../shared/review-header';

export function Header({
  reviewId,
  references,
  statusFilter,
  hideKeywordFilters,
  setHideKeywordFilters,
}: {
  reviewId: number;
  references: Reference[];
  statusFilter: string;
  hideKeywordFilters: boolean;
  setHideKeywordFilters: (value: boolean) => void;
}) {
  const fetchReview = useFetchReview(reviewId);
  const updateReview = useUpdateReview();
  const [openUploadDialog, setOpenUploadDialog] = useState(false);
  const [openMatchDialog, setOpenMatchDialog] = useState(false);
  const usefetchUploadedPDFs = useFetchUploadedPDFs(reviewId);
  const uploadPDF = useUploadPDF();
  const attachPDFsToReferences = useAttachPDFsToReferences();

  const handleUploadPDF = async (file: File): Promise<boolean> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      await uploadPDF.mutateAsync({
        file,
        review: reviewId,
      });

      return true;
    } catch (error) {
      return false;
    }
  };

  const handleMatch = async (
    mappings: ReferencePDFMapping[]
  ): Promise<boolean> => {
    try {
      // Call API to attach PDFs to references
      await attachPDFsToReferences.mutateAsync({ reviewId, mappings });
      return true;
    } catch (error) {
      return false;
    }
  };

  return (
    <>
      <FileUploadDialog
        open={openUploadDialog}
        onOpenChange={setOpenUploadDialog}
        onUpload={handleUploadPDF}
      />
      <MatchPDFDialog
        open={openMatchDialog}
        onOpenChange={setOpenMatchDialog}
        references={references}
        uploadedPDFs={usefetchUploadedPDFs.data || []}
        onImport={handleMatch}
      />
      <ReviewHeader reviewId={reviewId} />
      <div className="flex items-center justify-between w-full">
        <h3 className="text-sm font-semibold ">
          Showing {statusFilter} references
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-1"
            size="sm"
            onClick={() =>
              updateReview.mutate({
                id: Number(reviewId),
                payload: {
                  isBlinded: fetchReview.data?.isBlinded ? false : true,
                },
              })
            }
            disabled={updateReview.isPending || fetchReview.isLoading}
          >
            <Eye className="h-3 w-3" />
            {fetchReview.isLoading ? (
              <Spinner />
            ) : fetchReview.data?.isBlinded ? (
              'Blind On'
            ) : (
              'Blind Off'
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-1" size="sm">
                <FileText className="h-3 w-3" />
                PDF
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuItem onClick={() => setOpenUploadDialog(true)}>
                <Upload className="h-3 w-3" />
                Upload
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOpenMatchDialog(true)}>
                <FileSymlink className="h-3 w-3" />
                Match
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 bg-transparent"
            onClick={() => setHideKeywordFilters(!hideKeywordFilters)}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>
    </>
  );
}
