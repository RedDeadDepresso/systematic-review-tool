import { Button } from '@/components/ui/button';
import { Pause, Play } from 'lucide-react';
import { useScreeningStats } from '@/features/reviews/hooks/use-screening-stats';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../../components/ui/tooltip';

interface ScreeningBreakButtonProps {
  reviewId: number;
}

export function ScreeningBreakButton({ reviewId }: ScreeningBreakButtonProps) {
  const { isOnBreak, startBreak, endBreak } = useScreeningStats({
    reviewId,
    autoTrack: false, // Don't auto-track in this component
  });

  const handleToggleBreak = () => {
    if (isOnBreak) {
      endBreak();
    } else {
      startBreak();
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isOnBreak ? 'default' : 'outline'}
          size="sm"
          onClick={handleToggleBreak}
          className="gap-2"
        >
          {isOnBreak ? (
            <>
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Resume Work</span>
            </>
          ) : (
            <>
              <Pause className="h-4 w-4" />
              <span className="hidden sm:inline">Take Break</span>
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Resume/pause screening time tracking</TooltipContent>
    </Tooltip>
  );
}
