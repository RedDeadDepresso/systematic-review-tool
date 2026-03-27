// Section wrapper for a group of screening statistics.
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card } from '@/components/ui/card';
import { ChevronDownIcon } from 'lucide-react';
import { StatsTabs } from '@/features/reviews/components/screening-stats/stats-tabs';

interface StatsSectionProps {
  reviewId: number;
}

export function StatsSection({ reviewId }: StatsSectionProps) {
  return (
    <Collapsible>
      <Card className="py-0">
        <CollapsibleTrigger asChild>
          <button className="group flex w-full items-center justify-between p-6 hover:bg-accent/50 transition-colors rounded-t-lg">
            <h2 className="text-xl font-semibold text-foreground">
              Statistics
            </h2>
            <ChevronDownIcon className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-6 pb-6">
            <StatsTabs reviewId={reviewId} />
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
