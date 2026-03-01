import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  File,
  Triangle,
  Link,
  X,
  Lock,
  Unlock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  useFetchDuplicateClusters,
  useResolveCluster,
  useDismissCluster,
} from '@/features/references/hooks/use-reference-clusters';
import { ReferenceContent } from '@/features/references/components/references/reference-content';
import { Badge } from '@/components/ui/badge';
import { AutoResolverForm } from '@/features/references/components/reference-clusters/auto-resolver-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  ClusterMember,
  DuplicateCluster,
} from '@/features/references/api/reference-clusters';
import { cn } from '@/lib/utils';

interface ResolveDuplicatesDialogProps {
  reviewId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ResolveDuplicatesDialog({
  reviewId,
  isOpen,
  onClose,
}: ResolveDuplicatesDialogProps) {
  const [highlightDifference, setHighlightDifference] = useState(true);
  // Auto-resolver is shown first by default
  const [showAutoResolver, setShowAutoResolver] = useState(true);
  const [clusterIndex, setClusterIndex] = useState(0);
  const [comparingIndex, setComparingIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'left' | 'right'>('left');
  // Synchronized scrolling — enabled by default
  const [scrollLocked, setScrollLocked] = useState(true);

  // Refs for synchronized scroll
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  const { data, isLoading } = useFetchDuplicateClusters({ reviewId });
  const resolveMutation = useResolveCluster(reviewId);
  const dismissMutation = useDismissCluster(reviewId);

  const isPending = resolveMutation.isPending || dismissMutation.isPending;

  const clusters: DuplicateCluster[] = data?.clusters ?? [];
  const cluster: DuplicateCluster | undefined = clusters[clusterIndex];
  const members: ClusterMember[] = cluster?.members ?? [];

  const left: ClusterMember | undefined = members[0];
  const right: ClusterMember | undefined =
    members.length > 2 ? members[comparingIndex + 1] : members[1];

  const canGoPrev = comparingIndex > 0;
  const canGoNext = comparingIndex < members.length - 2;
  const canGoNextCluster = clusterIndex < clusters.length - 1;
  const canGoPrevCluster = clusterIndex > 0;

  // ── Synchronized scroll handlers ────────────────────────────────────────────

  const handleLeftScroll = useCallback(() => {
    if (!scrollLocked || isSyncingLeft.current) return;
    const leftEl = leftPaneRef.current;
    const rightEl = rightPaneRef.current;
    if (!leftEl || !rightEl) return;

    isSyncingRight.current = true;
    const ratio =
      leftEl.scrollTop / (leftEl.scrollHeight - leftEl.clientHeight || 1);
    rightEl.scrollTop = ratio * (rightEl.scrollHeight - rightEl.clientHeight);
    requestAnimationFrame(() => {
      isSyncingRight.current = false;
    });
  }, [scrollLocked]);

  const handleRightScroll = useCallback(() => {
    if (!scrollLocked || isSyncingRight.current) return;
    const leftEl = leftPaneRef.current;
    const rightEl = rightPaneRef.current;
    if (!leftEl || !rightEl) return;

    isSyncingLeft.current = true;
    const ratio =
      rightEl.scrollTop / (rightEl.scrollHeight - rightEl.clientHeight || 1);
    leftEl.scrollTop = ratio * (leftEl.scrollHeight - leftEl.clientHeight);
    requestAnimationFrame(() => {
      isSyncingLeft.current = false;
    });
  }, [scrollLocked]);

  // Reset scroll position when cluster changes
  useEffect(() => {
    if (leftPaneRef.current) leftPaneRef.current.scrollTop = 0;
    if (rightPaneRef.current) rightPaneRef.current.scrollTop = 0;
  }, [clusterIndex, comparingIndex]);

  // ── Cluster navigation ───────────────────────────────────────────────────────

  function advanceCluster() {
    setComparingIndex(0);
    setActiveTab('left');
    if (!canGoNextCluster) {
      setClusterIndex((i) => Math.max(0, i - 1));
    }
  }

  function handleKeep(member: ClusterMember) {
    if (!cluster) return;
    resolveMutation.mutate(
      { clusterId: cluster.id, canonicalReferenceId: member.reference.id },
      { onSuccess: advanceCluster }
    );
  }

  function handleDismiss() {
    if (!cluster) return;
    dismissMutation.mutate(
      { clusterId: cluster.id },
      { onSuccess: advanceCluster }
    );
  }

  const resolvedCount = data?.resolved ?? 0;
  const remainingCount = data?.remaining ?? 0;
  const progress = data?.progress ?? 0;
  const similarityPct = cluster
    ? Math.round(cluster.maxSimilarityScore * 100)
    : 0;
  const hasNoClusters = !isLoading && clusters.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full h-[100dvh] sm:h-auto p-0 gap-0 flex flex-col rounded-none sm:rounded-xl sm:max-h-[90vh] max-w-full sm:max-w-6xl sm:w-[90vw]">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="px-4 sm:px-5 py-3 border-b flex-shrink-0 bg-background">
          <div className="flex items-center justify-between gap-3 pr-7">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 bg-foreground rounded-md flex items-center justify-center flex-shrink-0">
                <File className="w-3.5 h-3.5 text-background" />
              </div>
              <h2 className="text-sm font-semibold truncate">
                {showAutoResolver ? 'Auto-Resolver' : 'Resolve Duplicates'}
              </h2>
              {cluster && members.length > 2 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                  {members.length} refs
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Toggle between auto and manual */}
              <Button
                variant={showAutoResolver ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setShowAutoResolver(true)}
                className="gap-1.5 h-7 text-xs"
              >
                <Sparkles className="h-3 w-3" />
                <span className="hidden sm:inline">Auto</span>
              </Button>
              {!hasNoClusters && (
                <Button
                  variant={!showAutoResolver ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setShowAutoResolver(false)}
                  className="gap-1.5 h-7 text-xs"
                >
                  <File className="h-3 w-3" />
                  <span className="hidden sm:inline">Manual</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Auto-resolver ────────────────────────────────────────────────── */}
        {showAutoResolver ? (
          <AutoResolverForm
            reviewId={reviewId}
            onClose={() => setShowAutoResolver(false)}
          />
        ) : (
          <>
            {/* ── Subheader ──────────────────────────────────────────────── */}
            {cluster && (
              <div className="flex items-center justify-between px-4 sm:px-5 py-2 border-b flex-shrink-0 bg-background gap-2 flex-wrap">
                {/* Left: cluster nav + DOI badge */}
                <div className="flex items-center gap-1.5 text-xs min-w-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-6 h-6 flex-shrink-0"
                    disabled={!canGoPrevCluster || isPending}
                    onClick={() => {
                      setClusterIndex((i) => i - 1);
                      setComparingIndex(0);
                    }}
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <span className="whitespace-nowrap">
                    <strong>{clusterIndex + 1}</strong> /{' '}
                    <strong>{clusters.length}</strong>
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-6 h-6 flex-shrink-0"
                    disabled={!canGoNextCluster || isPending}
                    onClick={() => {
                      setClusterIndex((i) => i + 1);
                      setComparingIndex(0);
                    }}
                  >
                    <ChevronRight className="w-3 h-3" />
                  </Button>

                  {cluster.doiMatch && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-300 text-emerald-700 bg-emerald-50 text-xs h-5 px-1.5"
                    >
                      <Link className="h-2.5 w-2.5" />
                      DOI
                    </Badge>
                  )}

                  {members.length > 2 && (
                    <div className="flex items-center gap-1 ml-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-5 h-5"
                        disabled={!canGoPrev}
                        onClick={() => setComparingIndex((i) => i - 1)}
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </Button>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {comparingIndex + 2}/{members.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-5 h-5"
                        disabled={!canGoNext}
                        onClick={() => setComparingIndex((i) => i + 1)}
                      >
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Right: scroll lock + dismiss */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDismiss}
                    disabled={isPending}
                    className="gap-1.5 h-7 text-xs"
                  >
                    <X className="w-3 h-3" />
                    <span className="hidden sm:inline">Not duplicates</span>
                    <span className="sm:hidden">Dismiss</span>
                  </Button>
                </div>
              </div>
            )}

            {/* ── Empty state ────────────────────────────────────────────── */}
            {hasNoClusters && (
              <div className="flex-1 flex items-center justify-center text-center text-muted-foreground p-8">
                <div className="space-y-2">
                  <p className="text-sm font-medium">All clusters resolved</p>
                  <p className="text-xs text-muted-foreground">
                    {data?.detail ??
                      'No unresolved duplicate clusters remaining.'}
                  </p>
                </div>
              </div>
            )}

            {/* ── Reference comparison ────────────────────────────────────── */}
            {cluster && left && right && (
              <>
                {/* Desktop: side-by-side with sync scroll */}
                <div className="hidden sm:flex flex-1 min-h-0 overflow-hidden">
                  <div
                    ref={leftPaneRef}
                    onScroll={handleLeftScroll}
                    className="flex-1 overflow-y-auto min-w-0"
                  >
                    <ReferencePaneHeader member={left} />
                    <div className="px-5 pb-6">
                      <ReferenceContent
                        reference={left.reference}
                        compareWith={right.reference}
                        side="left"
                        highlightDifference={highlightDifference}
                        noScroll={true}
                      />
                    </div>
                  </div>

                  <div className="w-px bg-border flex-shrink-0" />

                  <div
                    ref={rightPaneRef}
                    onScroll={handleRightScroll}
                    className="flex-1 overflow-y-auto min-w-0"
                  >
                    <ReferencePaneHeader member={right} />
                    <div className="px-5 pb-6">
                      <ReferenceContent
                        reference={right.reference}
                        compareWith={left.reference}
                        side="right"
                        highlightDifference={highlightDifference}
                        noScroll={true}
                      />
                    </div>
                  </div>
                </div>

                {/* Mobile: tabs */}
                <div className="flex-1 flex flex-col overflow-hidden sm:hidden min-h-0">
                  <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as 'left' | 'right')}
                    className="flex-1 flex flex-col overflow-hidden"
                  >
                    <TabsList className="w-full rounded-none border-b flex-shrink-0 h-9">
                      <TabsTrigger
                        value="left"
                        className="flex-1 gap-1 text-xs"
                      >
                        <ArrowLeft className="h-3 w-3" />
                        <span className="truncate max-w-[100px]">
                          {left.reference.title.slice(0, 18)}…
                        </span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="right"
                        className="flex-1 gap-1 text-xs"
                      >
                        <span className="truncate max-w-[100px]">
                          {right.reference.title.slice(0, 18)}…
                        </span>
                        <ArrowRight className="h-3 w-3" />
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent
                      value="left"
                      className="flex-1 overflow-y-auto px-4 mt-0 data-[state=inactive]:hidden"
                    >
                      <ReferencePaneHeader member={left} mobile />
                      <ReferenceContent
                        reference={left.reference}
                        compareWith={right.reference}
                        side="left"
                        highlightDifference={highlightDifference}
                        noScroll
                      />
                    </TabsContent>
                    <TabsContent
                      value="right"
                      className="flex-1 overflow-y-auto px-4 mt-0 data-[state=inactive]:hidden"
                    >
                      <ReferencePaneHeader member={right} mobile />
                      <ReferenceContent
                        reference={right.reference}
                        compareWith={left.reference}
                        side="right"
                        highlightDifference={highlightDifference}
                        noScroll
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}

            {/* ── Footer ──────────────────────────────────────────────────── */}
            {cluster && left && right && (
              <div className="px-4 sm:px-5 py-3 border-t flex-shrink-0 bg-background space-y-2.5">
                {/* Action row */}
                <div className="flex items-center gap-2">
                  {/* Mobile: stacked */}
                  <div className="flex sm:hidden items-center gap-2 w-full">
                    <SimilarityBadge
                      pct={similarityPct}
                      doiMatch={cluster.doiMatch}
                    />
                    <div className="flex gap-2 ml-auto">
                      <Button
                        onClick={() => handleKeep(left)}
                        disabled={isPending}
                        size="sm"
                        className="h-8 text-xs gap-1"
                      >
                        <ArrowLeft className="h-3 w-3" /> Left
                      </Button>
                      <Button
                        onClick={() => handleKeep(right)}
                        disabled={isPending}
                        size="sm"
                        className="h-8 text-xs gap-1"
                      >
                        Right <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Desktop: distributed */}
                  <div className="hidden sm:flex items-center w-full gap-3">
                    <Button
                      onClick={() => handleKeep(left)}
                      disabled={isPending}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Keep Left
                    </Button>

                    <div className="flex-1 flex items-center justify-center">
                      <SimilarityBadge
                        pct={similarityPct}
                        doiMatch={cluster.doiMatch}
                      />
                    </div>

                    <Button
                      onClick={() => handleKeep(right)}
                      disabled={isPending}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                    >
                      Keep Right
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Controls row */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Highlight toggle */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={highlightDifference}
                        onCheckedChange={setHighlightDifference}
                        className="scale-90"
                      />
                      <span className="text-xs font-medium">
                        Highlight diff
                      </span>
                    </div>

                    {/* Scroll lock toggle — also in footer for visibility */}
                    <button
                      onClick={() => setScrollLocked((v) => !v)}
                      className={cn(
                        'hidden sm:flex items-center gap-1.5 text-xs font-medium rounded px-2 py-1 transition-colors',
                        scrollLocked
                          ? 'text-foreground bg-muted'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      {scrollLocked ? (
                        <Lock className="w-3 h-3" />
                      ) : (
                        <Unlock className="w-3 h-3" />
                      )}
                      Sync scroll
                    </button>

                    {/* Legend */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-destructive/70 flex-shrink-0" />
                        <span>Unmatched</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-primary/70 flex-shrink-0" />
                        <span>Extra</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-2 min-w-[160px]">
                    <Triangle className="w-3 h-3 text-purple-500 shrink-0" />
                    <span className="text-xs font-medium whitespace-nowrap">
                      {resolvedCount} done · {remainingCount} left
                    </span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px]">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── ReferencePaneHeader ──────────────────────────────────────────────────────

function ReferencePaneHeader({
  member,
  mobile = false,
}: {
  member: ClusterMember;
  mobile?: boolean;
}) {
  return (
    <div
      className={cn(
        'sticky top-0 z-10 bg-background border-b px-5 py-2.5 flex items-start justify-between gap-2',
        mobile && 'px-0 mt-3'
      )}
    >
      <p className="text-sm font-semibold leading-snug line-clamp-2 flex-1 min-w-0">
        {member.reference.title}
      </p>
      <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
        {member.doiMatched && (
          <Badge
            variant="outline"
            className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50 gap-1 h-4 px-1.5 py-0"
          >
            <Link className="h-2.5 w-2.5" />
            DOI
          </Badge>
        )}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {Math.round(member.completenessScore * 100)}%
        </span>
        {member.reference.searchMethod && (
          <span className="text-xs text-muted-foreground/70 whitespace-nowrap max-w-[100px] truncate">
            {member.reference.searchMethod}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── SimilarityBadge ──────────────────────────────────────────────────────────

function SimilarityBadge({
  pct,
  doiMatch,
}: {
  pct: number;
  doiMatch: boolean;
}) {
  if (doiMatch) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-300 text-emerald-700 bg-emerald-50 gap-1.5 text-xs"
      >
        <Link className="w-3 h-3" />
        DOI match
      </Badge>
    );
  }

  const color =
    pct >= 90
      ? 'border-red-300 text-red-600 bg-red-50'
      : pct >= 75
        ? 'border-orange-300 text-orange-600 bg-orange-50'
        : 'border-yellow-300 text-yellow-600 bg-yellow-50';

  return (
    <Badge variant="outline" className={cn('gap-1.5 text-xs', color)}>
      <span
        className={cn(
          'w-2 h-2 rounded-full flex-shrink-0',
          pct >= 90
            ? 'bg-red-500'
            : pct >= 75
              ? 'bg-orange-500'
              : 'bg-yellow-500'
        )}
      />
      {pct}% similar
    </Badge>
  );
}
