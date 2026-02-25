import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ReviewMember } from '@/features/reviews/types/reviews';
import { CircleUser } from 'lucide-react';

export function AssigneeBadge({ assignee }: { assignee: ReviewMember }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="text-xs gap-1">
          <CircleUser className="h-3 w-3" />
          {assignee.user.firstName}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Assigned to {assignee.user.email}</TooltipContent>
    </Tooltip>
  );
}
