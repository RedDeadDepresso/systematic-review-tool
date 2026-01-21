import {
  Archive,
  ChevronRight,
  Folder,
  House,
  UserRoundPlus,
  Lock,
  type LucideIcon,
} from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Link, useRouter } from '@tanstack/react-router';
import { useFetchReviews } from '@/hooks/use-review';
import type { ReviewRow } from '@/types/review';

export type NavMainItem = {
  title: string;
  icon: LucideIcon;
  items?: ReviewRow[];
};

export function NavMain() {
  const { data: activeReviews } = useFetchReviews({
    isActive: true,
  });
  const { data: inactiveReviews } = useFetchReviews({
    isActive: false,
  });
  const router = useRouter();
  const items: NavMainItem[] = [
    {
      title: 'Archived Reviews',
      icon: Archive,
      items: inactiveReviews,
    },
    {
      title: 'Active Reviews',
      icon: Folder,
      items: activeReviews,
    },
  ];
  return (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Home"
            onClick={() => router.navigate({ to: '/' })}
          >
            <House />
            <span>Home</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {items.map((item) => (
          <Collapsible key={item.title} asChild className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={item.title}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items?.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild>
                        <Link
                          to="/reviews/$reviewId"
                          params={{ reviewId: subItem.id.toString() }}
                        >
                          <span>{subItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function NavMainUnauthenticated() {
  const router = useRouter();

  return (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Login"
            onClick={() => router.navigate({ to: '/login' })}
          >
            <Lock />
            <span>Login</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Register"
            onClick={() => router.navigate({ to: '/register' })}
          >
            <UserRoundPlus />
            <span>Register</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
