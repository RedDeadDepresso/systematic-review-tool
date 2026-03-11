import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Opinion } from '@/features/references/types/references';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { capitalize } from '@/lib/capitalize';

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
            opinion.status === 'included' &&
              'bg-green-50 text-green-700 border-green-200',
            opinion.status === 'maybe' &&
              'bg-yellow-50 text-yellow-700 border-yellow-200',
            opinion.status === 'excluded' &&
              'bg-red-50 text-red-700 border-red-200',
            opinion.status === 'undecided' &&
              'bg-gray-50 text-gray-600 border-gray-200'
          )}
        >
          {opinion.status === 'included' && '✓'}
          {opinion.status === 'maybe' && '?'}
          {opinion.status === 'excluded' && '✕'}
          <span>{opinion.member.user.firstName}</span>
          {opinion.reason && <span>- {opinion.reason}</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {capitalize(opinion.status)} by {opinion.member.user.email} at{' '}
        {opinion.updatedAt} {idx === 0 && '(Most Recent)'}
      </TooltipContent>
    </Tooltip>
  );
}
