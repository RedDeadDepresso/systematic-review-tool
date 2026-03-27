// Card displaying a single screening criterion.
import { Card } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ScreeningCriteriaContent,
  type ScreeningCriteriaProps,
} from '@/features/reviews/components/screening-criteria/screening-criteria-content';
import { ChevronDown } from 'lucide-react';

export function ScreeningCriteriaCard({
  reviewId,
  userRole,
}: ScreeningCriteriaProps) {
  return (
    <Collapsible>
      <Card className="py-0">
        <CollapsibleTrigger asChild>
          <button className="group flex w-full items-center justify-between p-6 hover:bg-accent/50 transition-colors rounded-t-lg">
            <h2 className="text-xl font-semibold text-foreground">
              Screening Criteria
            </h2>
            <ChevronDown className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScreeningCriteriaContent
            reviewId={reviewId}
            userRole={userRole}
            showHeader={false}
          />
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
