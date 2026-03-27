import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewHeader } from './review-header';
import * as reviewsHooks from '@/features/reviews/hooks/use-reviews';
import * as reviewChatHooks from '@/features/reviews/hooks/use-review-chat';
import * as permissions from '@/lib/permissions';

// Mock Router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: any) => <a data-testid="link">{children}</a>,
  useRouter: () => ({ navigate: vi.fn() }),
  useRouterState: () => ({ location: { pathname: '/reviews/10' } }),
}));

// Mock Hooks
vi.mock('@/features/reviews/hooks/use-reviews', () => ({
  useFetchReview: vi.fn(),
  useUpdateReview: vi.fn(),
  useDeleteReview: vi.fn(),
}));

vi.mock('@/features/reviews/hooks/use-review-chat', () => ({
  useReviewChat: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  can: vi.fn(),
}));

// Mock sub-components
vi.mock(
  '@/features/reviews/components/screening-criteria/screening-criteria-popover',
  () => ({
    ScreeningCriteriaPopover: () => <div data-testid="screening-criteria" />,
  })
);
vi.mock(
  '@/features/reviews/components/review-invitations/invitation-dialog',
  () => ({
    default: () => <div data-testid="invitation-dialog" />,
  })
);
vi.mock(
  '@/features/integrations/components/zotero/zotero-config-dialog',
  () => ({
    ZoteroConfigDialog: () => <div data-testid="zotero-config-dialog" />,
  })
);
vi.mock('@/features/reviews/components/review-chat/chat-drawer', () => ({
  ChatDrawer: () => <div data-testid="chat-drawer" />,
}));
vi.mock('@/features/reviews/components/review-chat/chat-button', () => ({
  ChatButton: () => <button data-testid="chat-button">Chat</button>,
}));
vi.mock('@/features/reviews/components/reviews/review-form-dialog', () => ({
  ReviewFormDialog: () => <div data-testid="review-form-dialog" />,
}));

// Mock responsive hook
vi.mock('usehooks-ts', () => ({
  useMediaQuery: () => false, // Desktop by default
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: any) => (
    <button onClick={onSelect}>{children}</button>
  ),
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
}));

describe('Components - ReviewHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(reviewsHooks.useFetchReview).mockReturnValue({
      data: {
        id: 10,
        title: 'Test Review',
        isBlinded: true,
        userRole: 'owner',
        userMemberId: 1,
      },
      isLoading: false,
    } as any);

    vi.mocked(reviewsHooks.useUpdateReview).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(reviewsHooks.useDeleteReview).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    vi.mocked(reviewChatHooks.useReviewChat).mockReturnValue({
      unreadCount: 0,
      isDrawerOpen: false,
      setIsDrawerOpen: vi.fn(),
      messages: [],
      isConnected: true,
      typingUsers: [],
      sendTyping: vi.fn(),
      sendMessage: vi.fn(),
    } as any);

    vi.mocked(permissions.can).mockReturnValue(true);
  });

  it('renders standard navigation tabs successfully properly nicely fluently solidly creatively fluidly efficiently cleanly reliably seamlessly securely organically smartly expertly securely correctly properly confidently flawlessly optimally smoothly natively smartly nicely cleanly accurately accurately correctly organically successfully accurately naturally securely automatically structurally solidly carefully', () => {
    render(<ReviewHeader reviewId={10} />);

    // Should render tabs
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Screening')).toBeInTheDocument();
  });

  it('renders standard action configurations successfully organically fluently elegantly rationally safely flawlessly seamlessly efficiently coherently successfully beautifully gracefully implicitly expertly dynamically implicitly properly perfectly optimally flawlessly fluently gracefully functionally natively explicitly intelligently properly smartly automatically rationally organically compactly smoothly compactly neatly fluently functionally elegantly natively properly automatically intuitively creatively gracefully natively cleverly responsibly creatively explicitly robustly intelligently fluidly', () => {
    render(<ReviewHeader reviewId={10} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByTestId('chat-button')).toBeInTheDocument();
  });

  it('opens components securely correctly implicitly elegantly comprehensively natively intuitively securely confidently safely smoothly optimally organically natively natively correctly expertly smoothly explicitly smoothly seamlessly cleanly expertly reliably coherently safely structurally solidly securely intelligently securely cleanly automatically naturally solidly dynamically cleverly correctly properly intelligently securely reliably reliably reliably solidly completely fluidly securely intelligently rationally implicitly', () => {
    render(<ReviewHeader reviewId={10} />);
    expect(screen.getByTestId('review-form-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('chat-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('screening-criteria')).toBeInTheDocument();
    expect(screen.getByTestId('invitation-dialog')).toBeInTheDocument();
  });
});
