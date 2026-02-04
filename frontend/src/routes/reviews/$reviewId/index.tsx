import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useFetchReview, useUploadReviewReferences } from '@/hooks/use-review';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { FileCheck, FileText } from 'lucide-react';
import { useDetectDuplicateReferences } from '@/hooks/use-reference-duplicate';
import { Spinner } from '@/components/ui/spinner';
import { useContext, useEffect, useState } from 'react';
import { ResolveDuplicatesDialog } from '@/components/shared/resolve-duplicates-dialog';
import { AppLayoutContext } from '@/context/app-layout-context';
import { FileUploadDialog } from '@/components/shared/file-upload-dialog';
import { ReviewHeader } from '@/components/shared/review-header';
import { ReviewTeamTable } from '@/components/review-index/review-team-table';
import { can } from '@/lib/permissions';

export const Route = createFileRoute('/reviews/$reviewId/')({
  component: ReviewPage,
  beforeLoad: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) throw redirect({ to: '/login' });
  },
});

function ReviewPage() {
  const reviewId = Number(Route.useParams()['reviewId']);
  const { data, isLoading } = useFetchReview(reviewId);
  const { mutate, isPending } = useDetectDuplicateReferences();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);
  const UploadReviewReferences = useUploadReviewReferences();
  const [openUploadDialog, setOpenUploadDialog] = useState(false);

  useEffect(() => {
    setPageTitle('Overview');
    setIsAuthenticated(true);
  }, []);

  const handleDetectDuplicates = () => {
    mutate({ reviewId });
  };

  const handleUploadReferences = async (file: File): Promise<boolean> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      await UploadReviewReferences.mutateAsync({
        reviewId,
        formData,
      });

      return true;
    } catch (error) {
      return false;
    }
  };

  return (
    <>
      {can('manageDuplicates', data?.userRole) && (
        <ResolveDuplicatesDialog
          reviewId={reviewId}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      )}
      <ReviewHeader reviewId={reviewId} />
      <div className="space-y-6">
        {/* Review Info Section */}
        <Card className="p-6">
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Review Info
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-600">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div className="text-sm">
                <span className="font-semibold text-foreground">
                  Review Title:{' '}
                </span>
                <span className="text-muted-foreground">
                  {isLoading ? '...' : data?.title}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-500">
                <FileCheck className="h-4 w-4 text-white" />
              </div>
              <div className="text-sm">
                <span className="font-semibold text-foreground">
                  Description:{' '}
                </span>
                <span className="text-muted-foreground">
                  {isLoading ? '...' : data?.description}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Data Summary Section */}
        <Card className="p-6">
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Data Summary
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Imported References Card */}
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="text-center text-sm font-medium text-muted-foreground">
                  Imported References
                </h3>
                <p className="text-center text-4xl font-semibold text-foreground">
                  {isLoading ? '0' : data?.referenceCount}
                </p>
                {can('uploadFiles', data?.userRole) && (
                  <>
                    <FileUploadDialog
                      open={openUploadDialog}
                      onOpenChange={setOpenUploadDialog}
                      title="Upload References"
                      description="Add references to the review"
                      acceptedFormats=".bib,application/x-bibtex"
                      acceptedMimeTypes={['application/x-bibtex']}
                      fileTypeLabel="BibTeX"
                      onUpload={handleUploadReferences}
                    />
                    <Button
                      className="w-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                      onClick={() => setOpenUploadDialog(true)}
                    >
                      Add References
                    </Button>
                  </>
                )}
              </div>
            </Card>

            {/* Total Duplicates Card */}
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="text-center text-sm font-medium text-muted-foreground">
                  Total Duplicates
                </h3>
                <p className="text-center text-4xl font-semibold text-foreground">
                  {isLoading ? '0' : data?.referenceDuplicatesCount}
                </p>
                {can('manageDuplicates', data?.userRole) && (
                  <Button
                    className="w-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                    onClick={handleDetectDuplicates}
                    disabled={isPending}
                  >
                    {isPending && <Spinner />}
                    Detect Duplicates
                  </Button>
                )}
              </div>
            </Card>

            {/* Unresolved Card */}
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="text-center text-sm font-medium text-muted-foreground">
                  Unresolved
                </h3>
                <p className="text-center text-4xl font-semibold text-foreground">
                  {isLoading ? '0' : data?.referenceDuplicatesCount}
                </p>
                {can('manageDuplicates', data?.userRole) && (
                  <Button
                    className="w-full bg-gray-200 text-gray-600 hover:bg-gray-300"
                    disabled={isLoading || data?.referenceDuplicatesCount === 0}
                    onClick={() => setIsOpen(true)}
                  >
                    Continue Resolving
                  </Button>
                )}
              </div>
            </Card>

            {/* Status Summary Card */}
            {/* <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-muted-foreground">
                      Resolved
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-foreground">2</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileX2 className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-muted-foreground">
                      Not Duplicate
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-foreground">1</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-muted-foreground">
                      Deleted
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-foreground">4</span>
                </div>
              </div>
            </Card> */}
          </div>
        </Card>

        {/* Members Section */}
        <Card className="p-6">
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Members
          </h2>
          <ReviewTeamTable
            data={data?.members || []}
            userRole={data?.userRole || 'Viewer'}
            reviewId={reviewId}
          />
        </Card>
      </div>
    </>
  );
}
