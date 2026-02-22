import { createFileRoute } from '@tanstack/react-router';
import { ReviewsTable } from '@/features/reviews/components/reviews/reviews-table';
import { useFetchReviews } from '@/features/reviews/hooks/use-reviews';
import { useContext, useEffect, useState } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchInvitations } from '@/features/reviews/hooks/use-invitations';
import { InvitationsTable } from '@/features/reviews/components/review-invitations/invitations-table';
import { redirectUnauthenticated } from '@/features/users/api/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: IndexPage,
  beforeLoad: redirectUnauthenticated,
});

function IndexPage() {
  const [inactiveEnabled, setInactiveEnabled] = useState(false);

  const { data: activeReviews = [], isLoading: isLoadingActive } =
    useFetchReviews({ isActive: true });

  const { data: inactiveReviews = [], isLoading: isLoadingInactive } =
    useFetchReviews({ isActive: false, enabled: inactiveEnabled });

  const { data: invitations = [], isLoading: isLoadingInvitations } =
    useFetchInvitations();

  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('Home');
    setIsAuthenticated(true);
    setScroll(true);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Invitations ── */}
      <Collapsible defaultOpen={false}>
        <Card className="py-0">
          <CollapsibleTrigger asChild>
            <button className="group flex w-full items-center justify-between p-6 hover:bg-accent/50 transition-colors rounded-lg">
              <h2 className="text-2xl font-semibold text-foreground">
                Invitations
                {!isLoadingInvitations && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({invitations.length})
                  </span>
                )}
              </h2>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-6">
              <InvitationsTable
                data={invitations}
                isLoading={isLoadingInvitations}
              />
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ── Reviews ── */}
      <Collapsible defaultOpen={true}>
        <Card className="py-0">
          <CollapsibleTrigger asChild>
            <button className="group flex w-full items-center justify-between p-6 hover:bg-accent/50 transition-colors rounded-t-lg">
              <h2 className="text-2xl font-semibold text-foreground">
                Reviews
              </h2>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-6">
              <Tabs
                defaultValue="active"
                onValueChange={(value) => {
                  if (value === 'inactive') setInactiveEnabled(true);
                }}
              >
                <TabsList className="mb-4">
                  <TabsTrigger value="active">
                    Active
                    {!isLoadingActive && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({activeReviews.length})
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="inactive">
                    Inactive
                    {!isLoadingInactive && inactiveEnabled && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({inactiveReviews.length})
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active">
                  <ReviewsTable
                    data={activeReviews}
                    isActive={true}
                    isLoading={isLoadingActive}
                  />
                </TabsContent>

                <TabsContent value="inactive">
                  <ReviewsTable
                    data={inactiveReviews}
                    isActive={false}
                    isLoading={isLoadingInactive}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
