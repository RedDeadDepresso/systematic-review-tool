import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Opinion } from '@/features/references/types/references';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OpinionBadgeProps {
  idx: number;
  opinion: Opinion;
}

export function OpinionBadge({ idx, opinion }: OpinionBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          className={cn(
            'flex items-center gap-1 text-xs',
            opinion.status === 'Included' &&
              'bg-green-50 text-green-700 border-green-200',
            opinion.status === 'Maybe' &&
              'bg-yellow-50 text-yellow-700 border-yellow-200',
            opinion.status === 'Excluded' &&
              'bg-red-50 text-red-700 border-red-200',
            opinion.status === 'Undecided' &&
              'bg-gray-50 text-gray-600 border-gray-200'
          )}
        >
          {opinion.status === 'Included' && '✓'}
          {opinion.status === 'Maybe' && '?'}
          {opinion.status === 'Excluded' && '✕'}
          <span>{opinion.member.user.firstName}</span>
          {opinion.reason && <span>- {opinion.reason}</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {opinion.status} by {opinion.member.user.email} at {opinion.updatedAt}{' '}
        {idx === 0 && '(Most Recent)'}
      </TooltipContent>
    </Tooltip>
  );
}
