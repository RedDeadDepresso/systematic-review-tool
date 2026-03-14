import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useFetchReview,
  useUploadReviewReferences,
  useDetectDuplicateReferences,
} from '@/features/reviews/hooks/use-reviews';
import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  FileCheck,
  FileText,
  CheckCircle2,
  FileX2,
  Trash2,
  ChevronDownIcon,
  Sparkles,
  ScanSearch,
  GitMerge,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useContext, useEffect, useState } from 'react';
import { ResolveDuplicatesDialog } from '@/features/references/components/reference-clusters/resolve-duplicates-dialog';
import { AppLayoutContext } from '@/context/app-layout-context';
import { FileUploadDialog } from '@/components/blocks/file-upload-dialog';
import { ReviewMembersTable } from '@/features/reviews/components/review-members/review-members-table';
import { can } from '@/lib/permissions';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ZoteroSyncPanel } from '@/features/integrations/components/zotero/zotero-sync-panel';
import { useFetchReviewMembers } from '@/features/reviews/hooks/use-review-members';
import { ScreeningCriteriaCard } from '@/features/reviews/components/screening-criteria/screening-criteria-card';
import { StatsSection } from '@/features/reviews/components/screening-stats/stats-section';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/reviews/$reviewId/')({
  component: ReviewPage,
  beforeLoad: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) throw redirect({ to: '/login' });
  },
});

// Which mode to open the dialog in
type DialogMode = 'auto' | 'manual';

function ReviewPage() {
  const reviewId = Number(Route.useParams()['reviewId']);
  const { data, isLoading } = useFetchReview(reviewId);
  const detectMutation = useDetectDuplicateReferences();

  // Dialog open state + which view to show on open
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('auto');

  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);
  const UploadReviewReferences = useUploadReviewReferences();
  const [openUploadDialog, setOpenUploadDialog] = useState(false);
  const [enabledMembers, setEnabledMembers] = useState(false);
  const fetchReviewMembers = useFetchReviewMembers(reviewId, enabledMembers);

  useEffect(() => {
    setPageTitle('Overview');
    setIsAuthenticated(true);
    setScroll(true);
  }, []);

  const handleUploadReferences = async (file: File): Promise<boolean> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await UploadReviewReferences.mutateAsync({ reviewId, formData });
      return true;
    } catch {
      return false;
    }
  };

  function openDialog(mode: DialogMode) {
    setDialogMode(mode);
    setDialogOpen(true);
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const detectionStatus = data?.duplicateDetectionStatus;
  const isPending = detectionStatus === 'pending' || detectMutation.isPending;
  const detectionDone = detectionStatus === 'completed';
  const detectionNotStarted = detectionStatus === 'not_started';
  const hasReferences = (data?.referenceCount ?? 0) > 0;
  const unresolvedCount = data?.duplicateClustersUnresolvedCount ?? 0;
  const totalClusters = data?.duplicateClustersCount ?? 0;

  return (
    <>
      {can('manageDuplicates', data?.userRole) && (
        <ResolveDuplicatesDialog
          reviewId={reviewId}
          isOpen={dialogOpen}
          initialView={dialogMode}
          onClose={() => setDialogOpen(false)}
        />
      )}

      <div className="space-y-6">
        {/* Review Info */}
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

        {/* Data Summary */}
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Data Summary
          </h2>
          <ZoteroSyncPanel reviewId={reviewId} />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                    {/* Counts row */}
                    <div className="flex items-end justify-center gap-6">
                      <StatPill
                        label=""
                        value={data?.referenceCount ?? 0}
                        loading={
                          data?.referenceCount === null ||
                          UploadReviewReferences.isPending
                        }
                      />
                    </div>

                    {can('uploadFiles', data?.userRole) && (
                      <>
                        <FileUploadDialog
                          open={openUploadDialog}
                          onOpenChange={setOpenUploadDialog}
                          title="Upload References"
                          description="Add references to the review (BibTeX, RIS, or EndNote XML format)"
                          acceptedFormats=".bib,.ris,.xml"
                          fileTypeLabel="BibTeX/RIS/EndNote XML"
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

            {/* Duplicates card — unified detect + resolve */}
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="text-center text-sm font-medium text-muted-foreground">
                  Duplicates
                </h3>

                {isLoading ? (
                  <>
                    <Skeleton className="h-12 w-24 mx-auto" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </>
                ) : (
                  <>
                    {/* Counts row */}
                    <div className="flex items-end justify-center gap-6">
                      <StatPill
                        label="Clusters"
                        value={
                          isPending
                            ? null
                            : detectionNotStarted && hasReferences
                              ? '?'
                              : totalClusters
                        }
                        loading={isPending}
                      />
                      <StatPill
                        label="Unresolved"
                        value={
                          isPending
                            ? null
                            : detectionNotStarted && hasReferences
                              ? '?'
                              : unresolvedCount
                        }
                        loading={isPending}
                        highlight={!isPending && unresolvedCount > 0}
                      />
                    </div>

                    {can('manageDuplicates', data?.userRole) && (
                      <DuplicateActionButtons
                        detectionNotStarted={detectionNotStarted}
                        detectionDone={detectionDone}
                        isPending={isPending}
                        hasReferences={hasReferences}
                        unresolvedCount={unresolvedCount}
                        onDetectOnly={() => detectMutation.mutate({ reviewId })}
                        onFindAndResolve={() => openDialog('auto')}
                        onManualResolve={() => openDialog('manual')}
                      />
                    )}
                  </>
                )}
              </div>
            </Card>

            {/* Status Summary */}
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

        <ScreeningCriteriaCard
          reviewId={reviewId}
          userRole={data?.userRole || 'viewer'}
        />

        {/* Members — collapsible */}
        <Collapsible>
          <Card className="py-0">
            <CollapsibleTrigger asChild onClick={() => setEnabledMembers(true)}>
              <button className="group flex w-full items-center justify-between p-6 hover:bg-accent/50 transition-colors rounded-t-lg">
                <h2 className="text-xl font-semibold text-foreground">
                  Members
                  {!fetchReviewMembers.isLoading &&
                    fetchReviewMembers?.data && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({fetchReviewMembers.data.length})
                      </span>
                    )}
                </h2>
                <ChevronDownIcon className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-6">
                <ReviewMembersTable
                  data={fetchReviewMembers.data || []}
                  userRole={data?.userRole || 'viewer'}
                  reviewId={reviewId}
                  isLoading={fetchReviewMembers.isLoading}
                />
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <StatsSection reviewId={reviewId} />
      </div>
    </>
  );
}

// ─── DuplicateActionButtons ───────────────────────────────────────────────────
// Renders the right set of CTAs depending on detection state.

interface DuplicateActionButtonsProps {
  detectionNotStarted: boolean;
  detectionDone: boolean;
  isPending: boolean;
  hasReferences: boolean;
  unresolvedCount: number;
  onDetectOnly: () => void;
  onFindAndResolve: () => void;
  onManualResolve: () => void;
}

function DuplicateActionButtons({
  detectionNotStarted,
  isPending,
  hasReferences,
  unresolvedCount,
  onDetectOnly,
  onFindAndResolve,
  onManualResolve,
}: DuplicateActionButtonsProps) {
  // ── State A: detection not yet run ────────────────────────────────────────
  if (detectionNotStarted) {
    return (
      <div className="space-y-2">
        {/* Primary: find + auto-resolve in one shot */}
        <Button
          className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={!hasReferences || isPending}
          onClick={onFindAndResolve}
        >
          <Sparkles className="h-4 w-4" />
          Find & Auto-Resolve
        </Button>

        {/* Secondary: detect only, resolve manually later */}
        <Button
          variant="outline"
          className="w-full gap-2"
          disabled={!hasReferences || isPending}
          onClick={onDetectOnly}
        >
          <ScanSearch className="h-4 w-4" />
          Detect Only
        </Button>

        {!hasReferences && (
          <p className="text-xs text-center text-muted-foreground">
            Upload references first
          </p>
        )}
      </div>
    );
  }

  // ── State B: detection running ─────────────────────────────────────────────
  if (isPending) {
    return (
      <Button className="w-full" disabled>
        <Spinner className="mr-2" />
        Detecting duplicates…
      </Button>
    );
  }

  // ── State C: detection done ────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {unresolvedCount > 0 ? (
        <>
          {/* Primary when there are clusters to resolve */}
          <Button
            className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={onFindAndResolve}
          >
            <Sparkles className="h-4 w-4" />
            Auto-Resolve
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onManualResolve}
          >
            <GitMerge className="h-4 w-4" />
            Review Manually ({unresolvedCount})
          </Button>
        </>
      ) : (
        // All resolved
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-emerald-600 font-medium">
          <CheckCircle2 className="h-4 w-4" />
          All duplicates resolved
        </div>
      )}
    </div>
  );
}

// ─── StatPill ─────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  loading,
  highlight,
}: {
  label: string;
  value: number | string | null;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={cn(
          'text-4xl font-semibold tabular-nums',
          highlight ? 'text-orange-500' : 'text-foreground'
        )}
      >
        {loading ? <Spinner className="h-8 w-8" /> : (value ?? 0)}
      </span>
      {label ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : (
        <span className="text-xs text-muted-foreground invisible">label</span>
      )}
    </div>
  );
}
