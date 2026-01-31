import { useUpdateReferenceOpinion } from '@/hooks/use-reference-opinion';
import { Button } from '../ui/button';
import type { Reference } from '@/types/reference';

export function DecisionButtons({
  reviewId,
  reference,
}: {
  reviewId: number;
  reference: Reference | null;
}) {
  const updateReferenceOpinion = useUpdateReferenceOpinion();

  return (
    <div className="flex gap-2 mb-4">
      <Button
        className="flex-1 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
        onClick={() =>
          reference &&
          updateReferenceOpinion.mutate({
            reviewId: reviewId,
            referenceId: reference.id,
            payload: { status: 'Included' },
          })
        }
        disabled={reference === null || updateReferenceOpinion.isPending}
      >
        ✓ Include
      </Button>

      <Button
        className="flex-1 bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100"
        onClick={() =>
          reference &&
          updateReferenceOpinion.mutate({
            reviewId: reviewId,
            referenceId: reference.id,
            payload: { status: 'Maybe' },
          })
        }
        disabled={reference === null || updateReferenceOpinion.isPending}
      >
        ? Maybe
      </Button>

      <Button
        className="flex-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
        onClick={() =>
          reference &&
          updateReferenceOpinion.mutate({
            reviewId: reviewId,
            referenceId: reference.id,
            payload: { status: 'Excluded' },
          })
        }
        disabled={reference === null || updateReferenceOpinion.isPending}
      >
        ✕ Exclude
      </Button>
    </div>
  );
}
