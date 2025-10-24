import { AppLayout } from '@/components/app-layout';
import { UploadReferencesForm } from '@/components/upload-references-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useFetchReview } from '@/hooks/use-review';
import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  CheckCircle2,
  FileCheck,
  FileText,
  FileX2,
  Trash2,
} from 'lucide-react';
import { ReviewNavigationMenu } from '@/components/review-navigation-menu';
import { useDetectDuplicateReferences } from '@/hooks/use-reference';
import { Spinner } from '@/components/ui/spinner';

export const Route = createFileRoute('/reviews/$reviewId')({
  component: ReviewPage,
  beforeLoad: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) throw redirect({ to: '/login' });
  },
});

function ReviewPage() {
  const { reviewId } = Route.useParams();
  const { data, isLoading } = useFetchReview(reviewId);
  const { mutate, isPending } = useDetectDuplicateReferences();

  const handleDetectDuplicates = () => {
    mutate({ reviewId });
  };

  return (
    <AppLayout
      pageTitle={isLoading ? '...' : data.title}
      isAuthenticated={true}
    >
      <ReviewNavigationMenu reviewId={reviewId} />
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
                  {isLoading ? '...' : data.title}
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
                  {isLoading ? '...' : data.description}
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Imported References Card */}
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="text-center text-sm font-medium text-muted-foreground">
                  Imported References
                </h3>
                <p className="text-center text-4xl font-semibold text-foreground">
                  {isLoading ? '0' : data.reference_count}
                </p>
                <UploadReferencesForm reviewId={reviewId} />
              </div>
            </Card>

            {/* Total Duplicates Card */}
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="text-center text-sm font-medium text-muted-foreground">
                  Total Duplicates
                </h3>
                <p className="text-center text-4xl font-semibold text-foreground">
                  {isLoading ? '0' : data.reference_duplicates_count}
                </p>
                <Button
                  className="w-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  onClick={handleDetectDuplicates}
                  disabled={isPending}
                >
                  {isPending && <Spinner />}
                  Detect Duplicates
                </Button>
              </div>
            </Card>

            {/* Unresolved Card */}
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="text-center text-sm font-medium text-muted-foreground">
                  Unresolved
                </h3>
                <p className="text-center text-4xl font-semibold text-foreground">
                  0
                </p>
                <Button
                  className="w-full bg-gray-200 text-gray-600 hover:bg-gray-300"
                  disabled
                >
                  Continue Resolving
                </Button>
              </div>
            </Card>

            {/* Status Summary Card */}
            <Card className="p-6">
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
            </Card>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
