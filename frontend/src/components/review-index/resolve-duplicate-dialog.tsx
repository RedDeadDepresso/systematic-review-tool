import { useState } from 'react';
import {
  ChevronLeft,
  UserPen,
  BookCheck,
  StickyNote,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Reference } from '@/types/reference';
import {
  useFetchDuplicateReferences,
  useResolveDuplicateReferences,
} from '@/hooks/use-reference-duplicate';

type ReferenceDetailsProps = {
  reviewId: number;
  referenceDuplicateId: number;
  mutate: (data: {
    reviewId: number;
    referenceDuplicateId: number;
    selection: 1 | 2;
  }) => void;
  isPending: boolean;
  data: Reference;
  similarityScore: number;
  position: 'Left' | 'Right';
  highlightDifference: boolean;
};

export function ReferenceDetails({
  reviewId,
  referenceDuplicateId,
  mutate,
  isPending,
  data,
  similarityScore,
  position,
  highlightDifference,
}: ReferenceDetailsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {highlightDifference ? (
          <h3 className="font-semibold text-base text-red-600">{data.title}</h3>
        ) : (
          <h3 className="font-semibold text-base">{data.title}</h3>
        )}
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserPen className="w-4 h-4" />
            <span className="font-medium">Authors:</span>
          </div>
          <div>{data.authors}</div>
        </div>

        {/* <div>
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4" />
          <span className="font-medium">Date:</span>
        </div>
        <div>2025-01-01</div>
      </div> */}

        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookCheck className="w-4 h-4" />
            <span className="font-medium">Journal:</span>
          </div>
          <div>{data.journal}</div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <StickyNote className="w-4 h-4" />
            <span className="font-medium">Publication Types:</span>
          </div>
          <div>{data.publicationTypes}</div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-4 h-4" />
            <span className="font-medium">Search Methods:</span>
          </div>
          <div>{data.searchMethods}</div>
        </div>
      </div>

      <div className="pt-4 border-t flex items-center justify-between">
        <Badge
          variant="outline"
          className="border-red-300 text-red-600 bg-red-50"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
          Similarity: {similarityScore * 100}%
        </Badge>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() =>
            mutate({
              reviewId: reviewId,
              referenceDuplicateId: referenceDuplicateId,
              selection: position === 'Left' ? 1 : 2,
            })
          }
          disabled={isPending}
        >
          Keep {position} Article
        </Button>
      </div>
    </div>
  );
}

interface ResolveDuplicatesModalProps {
  reviewId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ResolveDuplicatesDialog({
  reviewId,
  isOpen,
  onClose,
}: ResolveDuplicatesModalProps) {
  const [highlightDifference, setHighlightDifference] = useState(true);
  const { data, isLoading } = useFetchDuplicateReferences({ reviewId });
  const { mutate, isPending } = useResolveDuplicateReferences();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="min-w-6xl p-0 gap-0">
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
                Comparing <strong>{!isLoading ? data.reference1.id : 0}</strong>{' '}
                and <strong>{!isLoading ? data.reference2.id : 0}</strong>{' '}
                {/*out of <strong>2</strong>{' '}
              Articles.*/}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* <Button variant="outline" disabled={isPending}>
                Keep Both Articles
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button> */}
            </div>
          </div>
        )}
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-2 gap-6">
            {!isLoading && data?.detail && <p>All duplicates resolved.</p>}
            {!isLoading && !data?.detail && (
              <>
                <ReferenceDetails
                  reviewId={reviewId}
                  referenceDuplicateId={data.id}
                  mutate={mutate}
                  isPending={isPending}
                  data={data.reference1}
                  position="Left"
                  similarityScore={data.similarityScore}
                  highlightDifference={highlightDifference}
                />
                <ReferenceDetails
                  reviewId={reviewId}
                  referenceDuplicateId={data.id}
                  mutate={mutate}
                  isPending={isPending}
                  data={data.reference2}
                  position="Right"
                  similarityScore={data.similarityScore}
                  highlightDifference={highlightDifference}
                />
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={highlightDifference}
                onCheckedChange={setHighlightDifference}
              />
              <span className="text-sm font-medium">Highlight difference</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-red-200"></span>
                <span>Un-matched information</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-200"></span>
                <span>Extra information</span>
              </div>
            </div>
          </div>

          {/* <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <svg
                className="w-4 h-4 text-purple-600"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M7 14l5-5 5 5H7z" />
              </svg>
              <span className="font-medium">
                5 Done | 61 Articles Left to Resolve
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full"
                style={{ width: '7.5%' }}
              ></div>
            </div>
          </div> */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
