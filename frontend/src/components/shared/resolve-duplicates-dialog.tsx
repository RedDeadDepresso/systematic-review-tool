import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  useFetchDuplicateReferences,
  useResolveDuplicateReferences,
} from '@/hooks/use-reference-duplicate';
import { ReferenceContent } from './reference-content';
import { Badge } from '../ui/badge';
import { AutoResolverForm } from './auto-resolver-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [showAutoResolver, setShowAutoResolver] = useState(false);
  const [activeTab, setActiveTab] = useState('left'); // For mobile tabs

  const { data, isLoading } = useFetchDuplicateReferences({ reviewId });
  const { mutate, isPending } = useResolveDuplicateReferences();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full h-full sm:min-w-6xl p-0 gap-0 max-h-[100vh] sm:max-h-[90vh] flex flex-col sm:rounded-lg max-w-full sm:max-w-6xl">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-2 sm:gap-4 pr-6">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-3 h-3 sm:w-4 sm:h-4 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-base sm:text-lg font-semibold truncate">
                {showAutoResolver ? 'Auto-Resolver' : 'Resolve Duplicates'}
              </h2>
            </div>

            {/* Right side with button */}
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {!isLoading && !data?.detail && (
                <Button
                  variant={showAutoResolver ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowAutoResolver(!showAutoResolver)}
                  className="gap-1 sm:gap-2 text-xs sm:text-sm"
                >
                  <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">
                    {showAutoResolver ? 'Manual Resolution' : 'Auto-Resolver'}
                  </span>
                  <span className="sm:hidden">Auto</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {showAutoResolver ? (
          <AutoResolverForm
            reviewId={reviewId}
            onClose={() => setShowAutoResolver(false)}
          />
        ) : (
          <>
            {/* Subheader */}
            {!isLoading && !data?.detail && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-2 sm:py-3 border-b flex-shrink-0 gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm w-full sm:w-auto">
                  <Button
                    className="w-6 h-6 flex-shrink-0"
                    variant="outline"
                    size="icon"
                  >
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                  <span className="truncate">
                    Comparing <strong>{data.currentIndex}</strong> of{' '}
                    <strong>{data.total}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      mutate({
                        reviewId: reviewId,
                        referenceDuplicateId: data.pair.id,
                        selection: 3,
                      })
                    }
                    disabled={isPending}
                    className="text-xs sm:text-sm flex-1 sm:flex-initial"
                  >
                    Keep Both
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Content */}
            {!isLoading && data?.detail && (
              <div className="text-center text-muted-foreground p-4 sm:p-6 flex-1">
                {data.detail}
              </div>
            )}

            {!isLoading && data && !data.detail && (
              <>
                {/* Desktop: Side-by-side */}
                <div className="hidden sm:flex flex-1 overflow-hidden">
                  {/* Left Reference */}
                  <div className="flex-1 overflow-y-auto px-6">
                    <div className="sticky top-0 z-10 bg-background border-b pb-2 my-4">
                      <h3 className="text-sm font-semibold">
                        {data.pair.reference1.title}
                      </h3>
                    </div>
                    <ReferenceContent
                      reference={data.pair.reference1}
                      compareWith={data.pair.reference2}
                      side="left"
                      highlightDifference={highlightDifference}
                      noScroll={true}
                    />
                  </div>

                  {/* Right Reference */}
                  <div className="flex-1 overflow-y-auto px-6">
                    <div className="sticky top-0 z-10 bg-background border-b pb-2 my-4">
                      <h3 className="text-sm font-semibold">
                        {data.pair.reference2.title}
                      </h3>
                    </div>
                    <ReferenceContent
                      reference={data.pair.reference2}
                      compareWith={data.pair.reference1}
                      side="right"
                      highlightDifference={highlightDifference}
                      noScroll={true}
                    />
                  </div>
                </div>
                {/* Mobile: Tabs */}
                <div className="flex-1 flex flex-col overflow-hidden sm:hidden">
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="flex-1 flex flex-col overflow-hidden"
                  >
                    <TabsList className="w-full rounded-none border-b flex-shrink-0">
                      <TabsTrigger value="left" className="flex-1 gap-1">
                        <ArrowLeft className="h-3 w-3" />
                        Left Article
                      </TabsTrigger>
                      <TabsTrigger value="right" className="flex-1 gap-1">
                        Right Article
                        <ArrowRight className="h-3 w-3" />
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent
                      value="left"
                      className="flex-1 overflow-y-auto px-4 mt-0 data-[state=inactive]:hidden"
                    >
                      <div className="sticky top-0 z-10 bg-background border-b pb-2 my-4">
                        <h3 className="text-sm font-semibold">
                          {data.pair.reference1.title}
                        </h3>
                      </div>
                      <ReferenceContent
                        reference={data.pair.reference1}
                        compareWith={data.pair.reference2}
                        side="left"
                        highlightDifference={highlightDifference}
                        noScroll={true}
                      />
                    </TabsContent>

                    <TabsContent
                      value="right"
                      className="flex-1 overflow-y-auto px-4 mt-0 data-[state=inactive]:hidden"
                    >
                      <div className="sticky top-0 z-10 bg-background border-b pb-2 my-4">
                        <h3 className="text-sm font-semibold">
                          {data.pair.reference2.title}
                        </h3>
                      </div>
                      <ReferenceContent
                        reference={data.pair.reference2}
                        compareWith={data.pair.reference1}
                        side="right"
                        highlightDifference={highlightDifference}
                        noScroll={true}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}

            {/* Footer */}
            {!isLoading && data && !data.detail && (
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t space-y-3 flex-shrink-0">
                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-0 w-full">
                  {/* Mobile: Stacked layout */}
                  <div className="sm:hidden space-y-2">
                    <div className="flex items-center justify-center">
                      <Badge
                        variant="outline"
                        className="border-red-300 text-red-600 bg-red-50"
                      >
                        <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                        Similarity:{' '}
                        {Math.round(data.pair.similarityScore * 100)}%
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() =>
                          mutate({
                            reviewId: reviewId,
                            referenceDuplicateId: data.pair.id,
                            selection: 1,
                          })
                        }
                        disabled={isPending}
                        size="sm"
                        className="w-full"
                      >
                        <ArrowLeft className="h-3 w-3 mr-1" />
                        Keep Left
                      </Button>
                      <Button
                        onClick={() =>
                          mutate({
                            reviewId: reviewId,
                            referenceDuplicateId: data.pair.id,
                            selection: 2,
                          })
                        }
                        disabled={isPending}
                        size="sm"
                        className="w-full"
                      >
                        Keep Right
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>

                  {/* Desktop: Original layout */}
                  <div className="hidden sm:contents">
                    <Badge
                      variant="outline"
                      className="border-red-300 text-red-600 bg-red-50"
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                      Similarity: {Math.round(data.pair.similarityScore * 100)}%
                    </Badge>
                    <Button
                      className="justify-self-end mr-4"
                      onClick={() =>
                        mutate({
                          reviewId: reviewId,
                          referenceDuplicateId: data.pair.id,
                          selection: 1,
                        })
                      }
                      disabled={isPending}
                    >
                      Keep Left Article
                    </Button>
                    <Badge
                      variant="outline"
                      className="border-red-300 text-red-600 bg-red-50"
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                      Similarity: {Math.round(data.pair.similarityScore * 100)}%
                    </Badge>
                    <Button
                      className="justify-self-end"
                      onClick={() =>
                        mutate({
                          reviewId: reviewId,
                          referenceDuplicateId: data.pair.id,
                          selection: 2,
                        })
                      }
                      disabled={isPending}
                    >
                      Keep Right Article
                    </Button>
                  </div>
                </div>

                {/* Highlight toggle */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={highlightDifference}
                      onCheckedChange={setHighlightDifference}
                    />
                    <span className="text-xs sm:text-sm font-medium">
                      Highlight difference
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-destructive flex-shrink-0"></span>
                      <span>Un-matched</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-primary flex-shrink-0"></span>
                      <span>Extra info</span>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <svg
                      className="w-4 h-4 text-purple-600 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M7 14l5-5 5 5H7z" />
                    </svg>
                    <span className="font-medium">
                      {data.resolved} Done | {data.remaining} Left
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${data.progress}%` }}
                    />
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
