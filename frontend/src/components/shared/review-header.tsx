import { Grid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScreeningCriteriaPopover } from '@/components/shared/screening-criteria-popover';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from '../ui/navigation-menu';
import { Link, useRouterState } from '@tanstack/react-router';
import { useIsMobile } from '@/hooks/use-mobile';

interface ReviewHeaderProps {
  reviewId: number;
}

export function ReviewHeader({ reviewId }: ReviewHeaderProps) {
  const isMobile = useIsMobile();

  // detect the current route to highlight the active tab
  const { location } = useRouterState();
  const pathname = location.pathname;

  const tabs = [
    { label: 'Overview', path: `/reviews/${reviewId}` },
    { label: 'Review Data', path: `/reviews/${reviewId}/review-data` },
    { label: 'Screening', path: `/reviews/${reviewId}/screening` },
    {
      label: 'Full Text Screening',
      path: `/reviews/${reviewId}/full-text-screening`,
    },
    {
      label: 'Coding & Theming',
      path: `/reviews/${reviewId}/coding-theming`,
    },
  ];

  return (
    <header className="border-b border-border bg-card">
      {/* Tabs */}
      <div className="flex items-center justify-between px-2 sm:px-4 overflow-x-auto">
        <div className="w-full mb-6">
          <NavigationMenu viewport={isMobile} className="w-full">
            <NavigationMenuList className="flex w-full">
              {tabs.map((tab) => {
                const isActive = pathname === tab.path;
                return (
                  <NavigationMenuItem key={tab.path}>
                    <button>
                      <Link
                        to={tab.path}
                        params={{ reviewId: String(reviewId) }}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }
                  `}
                      >
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">
                          {tab.label.split(' ')[0]}
                        </span>
                      </Link>
                    </button>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden md:flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Blind mode</span>
            <Switch />
          </div>
          <ScreeningCriteriaPopover
            reviewId={reviewId}
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-transparent hidden lg:flex"
              >
                <Grid className="h-4 w-4" />
                Screening criteria
              </Button>
            }
          />
        </div>
      </div>
    </header>
  );
}
