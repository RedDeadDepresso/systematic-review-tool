import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFetchReview, useUploadReviewReferences } from '@/hooks/use-review';
import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  FileCheck,
  FileText,
  CheckCircle2,
  FileX2,
  Trash2,
  ChevronDownIcon,
} from 'lucide-react';
import { useDetectDuplicateReferences } from '@/hooks/use-reference-duplicate';
import { Spinner } from '@/components/ui/spinner';
import { useContext, useEffect, useState } from 'react';
import { ResolveDuplicatesDialog } from '@/components/shared/resolve-duplicates-dialog';
import { AppLayoutContext } from '@/context/app-layout-context';
import { FileUploadDialog } from '@/components/shared/file-upload-dialog';
import { ReviewTeamTable } from '@/components/review-index/review-team-table';
import { can } from '@/lib/permissions';
import { StatsTabs } from '@/components/review-index/stats-tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ZoteroSyncPanel } from '@/components/review-index/zotero-sync-panel';

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
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);
  const UploadReviewReferences = useUploadReviewReferences();
  const [openUploadDialog, setOpenUploadDialog] = useState(false);

  useEffect(() => {
    setPageTitle('Overview');
    setIsAuthenticated(true);
    setScroll(true);
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
      <div className="space-y-6">
        {/* Review Info Section */}
        <Card className="p-6">
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Review Info
          </h2>
          {isLoading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-600">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-foreground">
                    Review Title:{' '}
                  </span>
                  <span className="text-muted-foreground">{data?.title}</span>
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
                    {data?.description}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Data Summary Section */}
        <Card className="p-6">
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Data Summary
          </h2>
          <ZoteroSyncPanel reviewId={reviewId} />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Imported References Card */}
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="text-center text-sm font-medium text-muted-foreground">
                  Imported References
                </h3>
                {isLoading ? (
                  <>
                    <Skeleton className="h-12 w-24 mx-auto" />
                    <Skeleton className="h-10 w-full" />
                  </>
                ) : (
                  <>
                    <p className="text-center text-4xl font-semibold text-foreground">
                      {data?.referenceCount}
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
                {isLoading ? (
                  <>
                    <Skeleton className="h-12 w-24 mx-auto" />
                    <Skeleton className="h-10 w-full" />
                  </>
                ) : (
                  <>
                    <p className="text-center text-4xl font-semibold text-foreground">
                      {data?.duplicatePairsCount}
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
                  </>
                )}
              </div>
            </Card>

            {/* Unresolved Card */}
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="text-center text-sm font-medium text-muted-foreground">
                  Unresolved
                </h3>
                {isLoading ? (
                  <>
                    <Skeleton className="h-12 w-24 mx-auto" />
                    <Skeleton className="h-10 w-full" />
                  </>
                ) : (
                  <>
                    <p className="text-center text-4xl font-semibold text-foreground">
                      {data?.duplicatePairsUnresolvedCount}
                    </p>
                    {can('manageDuplicates', data?.userRole) && (
                      <Button
                        className="w-full bg-gray-200 text-gray-600 hover:bg-gray-300"
                        disabled={data?.duplicatePairsUnresolvedCount === 0}
                        onClick={() => setIsOpen(true)}
                      >
                        Continue Resolving
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Card>

            {/* Status Summary Card */}
            <Card className="p-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-8 w-12" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-muted-foreground">
                        Resolved
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-foreground">
                      {data?.duplicateResolvedCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileX2 className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-muted-foreground">
                        Not Duplicate
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-foreground">
                      {data?.duplicateNotDuplicateCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-muted-foreground">
                        Deleted
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-foreground">
                      {data?.duplicateDeletedCount}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </Card>

        {/* Members Section - Collapsible */}
        <Collapsible>
          <Card className="py-0">
            <CollapsibleTrigger asChild>
              <button className="group flex w-full items-center justify-between p-6 hover:bg-accent/50 transition-colors rounded-t-lg">
                <h2 className="text-xl font-semibold text-foreground">
                  Members
                  {!isLoading && data?.members && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({data.members.length})
                    </span>
                  )}
                </h2>
                <ChevronDownIcon className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-6">
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                ) : (
                  <ReviewTeamTable
                    data={data?.members || []}
                    userRole={data?.userRole || 'Viewer'}
                    reviewId={reviewId}
                  />
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Statistics Section - Collapsible */}
        <Collapsible>
          <Card className="py-0">
            <CollapsibleTrigger asChild>
              <button className="group flex w-full items-center justify-between p-6 hover:bg-accent/50 transition-colors rounded-t-lg">
                <h2 className="text-xl font-semibold text-foreground">
                  Statistics
                </h2>
                <ChevronDownIcon className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-6">
                {isLoading ? (
                  <div className="space-y-4">
                    {/* Tabs skeleton */}
                    <div className="flex gap-2 border-b">
                      <Skeleton className="h-10 w-32" />
                      <Skeleton className="h-10 w-32" />
                      <Skeleton className="h-10 w-32" />
                    </div>
                    {/* Chart skeleton */}
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <Skeleton className="h-16 w-32" />
                        <Skeleton className="h-16 w-32" />
                      </div>
                      <Skeleton className="h-[400px] w-full" />
                    </div>
                  </div>
                ) : (
                  <StatsTabs
                    screeningStats={data?.screeningStats || []}
                    screeningOpinions={data?.screeningOpinions || []}
                    fullTextOpinions={data?.fullTextOpinions || []}
                  />
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </>
  );
}
