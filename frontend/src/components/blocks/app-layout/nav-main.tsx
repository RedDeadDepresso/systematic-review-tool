import {
  Archive,
  ChevronRight,
  Folder,
  House,
  UserRoundPlus,
  Lock,
  Search,
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
  useSidebar,
} from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { Link, useRouter } from '@tanstack/react-router';
import { useFetchReviews } from '@/features/reviews/hooks/use-reviews';
import type { ReviewRow } from '@/features/reviews/types/reviews';
import { IconKey } from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { BookOpen } from 'lucide-react';

const DOC_LINKS = [
  { title: 'Introduction', href: '/docs/introduction' },
  {
    title: 'User Guide',
    children: [
      { title: 'Getting Started', href: '/docs/user-guide/getting-started' },
      { title: 'Review Overview', href: '/docs/user-guide/review-overview' },
    ],
  },
];

function DocsSection() {
  const [open, setOpen] = useState(false);
  const { state, setOpen: setSidebarOpen } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const handleClick = () => {
    if (isCollapsed) {
      setSidebarOpen(true);
      setOpen(true);
    } else {
      setOpen((prev) => !prev);
    }
  };

  return (
    <Collapsible
      asChild
      className="group/collapsible"
      open={isCollapsed ? false : open}
      onOpenChange={setOpen}
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip="Documentation" onClick={handleClick}>
            <BookOpen />
            <span>Documentation</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {DOC_LINKS.map((item) =>
              'children' in item ? (
                // Nested group (no further collapsible, just a label + items)
                <SidebarMenuSubItem key={item.title}>
                  <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {item.title}
                  </p>
                  {item.children.map((child) => (
                    <SidebarMenuSubButton key={child.href} asChild>
                      <Link to={child.href}>
                        <span>{child.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  ))}
                </SidebarMenuSubItem>
              ) : (
                <SidebarMenuSubItem key={item.href}>
                  <SidebarMenuSubButton asChild>
                    <Link to={item.href}>
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export type NavMainItem = {
  title: string;
  icon: LucideIcon;
  items?: ReviewRow[];
  onClick?: () => void;
};

interface ReviewSectionProps {
  title: string;
  icon: LucideIcon;
  reviews: ReviewRow[];
  onOpen: () => void;
}

function ReviewSection({
  title,
  icon: Icon,
  reviews,
  onOpen,
}: ReviewSectionProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const { state, setOpen: setSidebarOpen } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const filtered = useMemo(() => {
    if (!search.trim()) return reviews;
    return reviews.filter((r) =>
      r.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [reviews, search]);

  const handleClick = () => {
    if (isCollapsed) {
      setSidebarOpen(true);
      setOpen(true);
      onOpen();
    } else {
      if (!open) onOpen();
      setOpen((prev) => !prev);
    }
  };

  return (
    <Collapsible
      asChild
      className="group/collapsible"
      open={isCollapsed ? false : open}
      onOpenChange={setOpen}
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={title} onClick={handleClick}>
            <Icon />
            <span>{title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {!isCollapsed && (
            <div className="px-2 py-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-7 pl-7 text-xs"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
          <SidebarMenuSub>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {reviews.length === 0 ? 'No reviews' : 'No matches'}
              </p>
            ) : (
              filtered.map((subItem) => (
                <SidebarMenuSubItem key={subItem.id}>
                  <SidebarMenuSubButton asChild>
                    <Link
                      to="/reviews/$reviewId"
                      params={{ reviewId: subItem.id.toString() }}
                    >
                      <span>{subItem.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function NavMain() {
  const [activeEnabled, setActiveEnabled] = useState(false);
  const [archivedEnabled, setArchivedEnabled] = useState(false);

  const { data: activeReviews = [] } = useFetchReviews({
    isActive: true,
    enabled: activeEnabled,
  });
  const { data: archivedReviews = [] } = useFetchReviews({
    isActive: false,
    enabled: archivedEnabled,
  });

  const router = useRouter();

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

        <ReviewSection
          title="Active Reviews"
          icon={Folder}
          reviews={activeReviews}
          onOpen={() => setActiveEnabled(true)}
        />

        <ReviewSection
          title="Archived Reviews"
          icon={Archive}
          reviews={archivedReviews}
          onOpen={() => setArchivedEnabled(true)}
        />
        <DocsSection />
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
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Reset Password"
            onClick={() => router.navigate({ to: '/request-password-reset' })}
          >
            <IconKey />
            <span>Reset Password</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <DocsSection />
      </SidebarMenu>
    </SidebarGroup>
  );
}
