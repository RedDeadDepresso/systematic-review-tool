import { Grid, UserPlus, MoreVertical, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScreeningCriteriaPopover } from '@/components/shared/screening-criteria-popover';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from '../ui/navigation-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link, useRouterState } from '@tanstack/react-router';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFetchReview, useUpdateReview } from '@/hooks/use-review';
import InvitationDialog from './invitation-dialog';
import { can } from '@/lib/permissions';
import { ZoteroConfigDialog } from '../review-index/zotero-config-dialog';
import { ChatDrawer } from './chat-drawer';
import { ChatButton } from './chat-button';
import { useReviewChat } from '@/hooks/use-review-chat';
import { useState } from 'react';

interface ReviewHeaderProps {
  reviewId: number;
}

export function ReviewHeader({ reviewId }: ReviewHeaderProps) {
  const isMobile = useIsMobile();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showZoteroDialog, setShowZoteroDialog] = useState(false);
  const [showCriteriaPopover, setShowCriteriaPopover] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // detect the current route to highlight the active tab
  const { location } = useRouterState();
  const pathname = location.pathname;

  const fetchReview = useFetchReview(reviewId);
  const updateReview = useUpdateReview();

  const {
    unreadCount,
    isDrawerOpen,
    setIsDrawerOpen,
    messages,
    isConnected,
    typingUsers,
    sendTyping,
    sendMessage,
  } = useReviewChat({
    reviewId,
    userMemberId: fetchReview.data?.userMemberId || null,
    enabled: true,
  });

  const tabs = [
    { label: 'Overview', path: `/reviews/${reviewId}` },
    { label: 'Review Data', path: `/reviews/${reviewId}/review-data` },
    { label: 'Screening', path: `/reviews/${reviewId}/screening` },
    {
      label: 'Full Text Screening',
      path: `/reviews/${reviewId}/full-text-screening`,
    },
    {
      label: 'Data Extraction',
      path: `/reviews/${reviewId}/data-extraction`,
    },
    {
      label: 'Coding & Theming',
      path: `/reviews/${reviewId}/coding-theming`,
    },
    {
      label: 'Charts',
      path: `/reviews/${reviewId}/charts`,
    },
    {
      label: 'PRISMA',
      path: `/reviews/${reviewId}/prisma`,
    },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      {/* Single Row - Tabs + Actions */}
      <div className="flex items-center justify-between gap-2 px-2 sm:px-4">
        {/* Navigation Tabs */}
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <NavigationMenu viewport={isMobile} className="w-full">
            <NavigationMenuList className="flex min-w-max lg:min-w-0">
              {tabs.map((tab) => {
                const isActive = pathname === tab.path;
                return (
                  <NavigationMenuItem key={tab.path}>
                    <Link
                      to={tab.path}
                      params={{ reviewId: String(reviewId) }}
                      className={`inline-flex items-center px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap
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
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Chat Button */}
        <ChatButton
          onClick={() => setIsDrawerOpen(true)}
          unreadCount={unreadCount}
        />

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Dropdown Menu for Settings */}
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <MoreVertical className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Review Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Blind Mode Toggle */}
              <div className="px-2 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Blind mode</span>
                    <span className="text-xs text-muted-foreground">
                      {fetchReview.data?.isBlinded
                        ? "Members cannot see each other's opinions"
                        : "Members can see each other's opinions"}
                    </span>
                  </div>
                  <Switch
                    checked={fetchReview.data?.isBlinded}
                    onCheckedChange={() =>
                      updateReview.mutate({
                        id: reviewId,
                        payload: { isBlinded: !fetchReview.data?.isBlinded },
                      })
                    }
                    disabled={
                      fetchReview.isLoading ||
                      fetchReview.data?.userRole !== 'Owner'
                    }
                  />
                </div>
              </div>

              <DropdownMenuSeparator />

              {/* Screening Criteria - Open controlled popover */}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setShowCriteriaPopover(!showCriteriaPopover);
                }}
              >
                <Grid className="h-4 w-4 mr-2" />
                Screening criteria
              </DropdownMenuItem>

              {can('uploadFiles', fetchReview.data?.userRole) && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setShowZoteroDialog(true);
                    setDropdownOpen(true);
                  }}
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  Configure Zootero
                </DropdownMenuItem>
              )}

              {/* Invite Members */}
              {can('invite', fetchReview.data?.userRole) && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setShowInviteDialog(true);
                    setDropdownOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite members
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Screening Criteria Popover */}
      <ScreeningCriteriaPopover
        reviewId={reviewId}
        userRole={fetchReview.data?.userRole || 'Viewer'}
        open={showCriteriaPopover}
        onOpenChange={setShowCriteriaPopover}
        trigger={<button className="hidden" aria-hidden="true" />}
      />

      {/* Invite Dialog */}
      {can('invite', fetchReview.data?.userRole) && (
        <InvitationDialog
          reviewId={reviewId}
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
        />
      )}

      {can('uploadFiles', fetchReview.data?.userRole) && (
        <ZoteroConfigDialog
          reviewId={reviewId}
          open={showZoteroDialog}
          onOpenChange={setShowZoteroDialog}
        />
      )}

      {/* Chat Drawer */}
      <ChatDrawer
        reviewId={reviewId}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        messages={messages}
        isConnected={isConnected}
        sendMessage={sendMessage}
        typingUsers={typingUsers}
        sendTyping={sendTyping}
      />
    </header>
  );
}
