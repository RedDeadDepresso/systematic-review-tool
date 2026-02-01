import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useFetchDuplicateReferences,
  useResolveDuplicateReferences,
} from '@/hooks/use-reference-duplicate';
import { ReferenceContent } from './reference-content';
import { Badge } from '../ui/badge';

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
  const { data, isLoading } = useFetchDuplicateReferences({ reviewId });
  const { mutate, isPending } = useResolveDuplicateReferences();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="min-w-6xl p-0 gap-0 max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-lg font-semibold">Resolve Duplicates</span>
            </DialogTitle>
          </div>
        </DialogHeader>
        {/* Subheader */}
        {!isLoading && !data?.detail && (
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <div className="flex items-center gap-2 text-sm">
              <Button className="w-6 h-6" variant="outline">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span>
                Comparing <strong>{data.currentIndex}</strong> out of{' '}
                <strong>{data.total}</strong> Articles
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  mutate({
                    reviewId: reviewId,
                    referenceDuplicateId: data.pair.id,
                    selection: 3,
                  })
                }
                disabled={isPending}
              >
                Keep Both Articles
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        {!isLoading && data?.detail && (
          <div className="text-center text-red-600 font-medium p-6">
            {data.detail}
          </div>
        )}

        {!isLoading && data && !data.detail && (
          <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
            {/* Left Reference */}
            <div className="overflow-y-auto px-6">
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
              />
            </div>

            {/* Right Reference */}
            <div className="overflow-y-auto px-6">
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
              />
            </div>
          </div>
        )}

        {/* Footer */}
        {!isLoading && data && !data.detail && (
          <div className="px-6 py-4 border-t space-y-3">
            <div className="grid grid-cols-4 grid-rows-1 w-full">
              <Badge
                variant="outline"
                className="border-red-300 text-red-600 bg-red-50"
              >
                <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                Similarity: {data.pair.similarityScore * 100}%
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
                Similarity: {data.pair.similarityScore * 100}%
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

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={highlightDifference}
                  onCheckedChange={setHighlightDifference}
                />
                <span className="text-sm font-medium">
                  Highlight difference
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-destructive"></span>
                  <span>Un-matched information</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-primary"></span>
                  <span>Extra information</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <svg
                  className="w-4 h-4 text-purple-600"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M7 14l5-5 5 5H7z" />
                </svg>
                <span className="font-medium">
                  {data.resolved} Done | {data.remaining} Articles Left to
                  Resolve
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
      </DialogContent>
    </Dialog>
  );
}
