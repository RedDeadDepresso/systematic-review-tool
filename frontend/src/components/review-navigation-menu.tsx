import {
  NavigationMenuList,
  NavigationMenu,
  NavigationMenuItem,
} from './ui/navigation-menu';
import { Link, useRouterState } from '@tanstack/react-router';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@radix-ui/react-separator';

export function ReviewNavigationMenu({
  reviewId,
}: {
  reviewId: string | number;
}) {
  const isMobile = useIsMobile();

  // detect the current route to highlight the active tab
  const { location } = useRouterState();
  const pathname = location.pathname;

  const tabs = [
    { label: 'Overview', path: `/reviews/${reviewId}` },
    { label: 'Review Data', path: `/review-data/${reviewId}` },
    { label: 'Screening', path: `/screening/${reviewId}` },
  ];

  return (
    <div className="w-full">
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
                    {tab.label}
                  </Link>
                </button>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
