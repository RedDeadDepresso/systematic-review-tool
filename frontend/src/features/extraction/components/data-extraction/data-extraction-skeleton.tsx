// Skeleton loading state for the data-extraction table.
import { Skeleton } from '@/components/ui/skeleton';

const SKELETON_ROW_COUNT = 14;
const DEFAULT_QUESTION_COL_COUNT = 4;

interface DataExtractionSkeletonProps {
  questionCount?: number;
}

export function DataExtractionSkeleton({
  questionCount = DEFAULT_QUESTION_COL_COUNT,
}: DataExtractionSkeletonProps) {
  const questionCols = Array.from({ length: questionCount });

  return (
    <>
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
        <tr key={i} className="border-b border-border h-14">
          {/* Checkbox */}
          <td className="px-4 py-3 w-12">
            <Skeleton className="h-4 w-4 rounded" />
          </td>

          {/* Index */}
          <td className="px-4 py-3 w-12">
            <Skeleton className="h-4 w-4" />
          </td>

          {/* Title */}
          <td className="px-4 py-3 min-w-[200px] max-w-[300px]">
            <Skeleton className="h-4 w-full mb-1.5" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-1.5 mt-2">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </td>

          {/* Completed */}
          <td className="px-4 py-3 w-24">
            <Skeleton className="h-5 w-5 rounded-full" />
          </td>

          {/* PDF */}
          <td className="px-4 py-3 w-28">
            <Skeleton className="h-8 w-20 rounded-md" />
          </td>

          {/* Dynamic question columns */}
          {questionCols.map((_, j) => (
            <td
              key={j}
              className="px-4 py-3 border-l border-border min-w-[120px]"
            >
              <Skeleton className="h-4 w-full" />
            </td>
          ))}

          {/* Trailing add-question column */}
          <td className="px-4 py-3 w-12 border-l border-border" />
        </tr>
      ))}
    </>
  );
}
