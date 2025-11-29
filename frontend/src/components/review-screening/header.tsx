import { useEditReview, useFetchReview } from '@/hooks/use-review';
import { ReviewNavigationMenu } from '../review-index/review-navigation-menu';
import { Button } from '../ui/button';
import { Eye, Filter, Upload } from 'lucide-react';
import { Spinner } from '../ui/spinner';
import { UploadReferenceFileDialog } from './upload-reference-file-dialog';

export function Header({
  reviewId,
  referenceId,
  statusFilter,
  hideKeywordFilters,
  setHideKeywordFilters,
}: {
  reviewId: number;
  referenceId: number;
  statusFilter: string;
  hideKeywordFilters: boolean;
  setHideKeywordFilters: (value: boolean) => void;
}) {
  const fetchReview = useFetchReview(reviewId);
  const editReview = useEditReview();

  return (
    <>
      <ReviewNavigationMenu reviewId={reviewId} />
      <div className="flex items-center justify-between w-full mt-6">
        <h3 className="text-sm font-semibold ">
          Showing {statusFilter} references
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-1"
            size="sm"
            onClick={() =>
              editReview.mutate({
                id: Number(reviewId),
                data: {
                  is_blinded: fetchReview.data?.is_blinded ? false : true,
                },
              })
            }
            disabled={editReview.isPending || fetchReview.isLoading}
          >
            <Eye className="h-3 w-3" />
            {fetchReview.isLoading ? (
              <Spinner />
            ) : fetchReview.data?.is_blinded ? (
              'Blind On'
            ) : (
              'Blind Off'
            )}
          </Button>
          <UploadReferenceFileDialog
            reviewId={reviewId}
            referenceId={referenceId}
          />
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
