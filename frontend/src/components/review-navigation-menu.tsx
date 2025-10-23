import {
  NavigationMenuList,
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
} from './ui/navigation-menu';
import { Link } from '@tanstack/react-router';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';

export function ReviewNavigationMenu({
  reviewId,
}: {
  reviewId: string | number;
}) {
  const isMobile = useIsMobile();

  return (
    <NavigationMenu viewport={isMobile} className="w-full">
      <NavigationMenuList className="flex">
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link
              to="/reviews/$reviewId"
              params={{ reviewId: String(reviewId) }}
            >
              Overview
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <Separator
            orientation="vertical"
            className="data-[orientation=vertical]:h-6"
          />
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link
              to="/review-data/$reviewId"
              params={{ reviewId: String(reviewId) }}
            >
              Review Data
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
