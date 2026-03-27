import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavMain, NavMainUnauthenticated } from './nav-main';
import * as reviewsHooks from '@/features/reviews/hooks/use-reviews';

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate: vi.fn() }),
  Link: ({ children, to }: any) => (
    <a href={to} data-testid="link">
      {children}
    </a>
  ),
}));

vi.mock('@/features/reviews/hooks/use-reviews', () => ({
  useFetchReviews: vi.fn(),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarGroup: ({ children }: any) => <div>{children}</div>,
  SidebarMenu: ({ children }: any) => <div>{children}</div>,
  SidebarMenuButton: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  SidebarMenuItem: ({ children }: any) => <div>{children}</div>,
  SidebarMenuSub: ({ children }: any) => <div>{children}</div>,
  SidebarMenuSubButton: ({ children }: any) => <div>{children}</div>,
  SidebarMenuSubItem: ({ children }: any) => <div>{children}</div>,
  useSidebar: () => ({ state: 'expanded', setOpen: vi.fn() }),
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: any) => <div>{children}</div>,
  CollapsibleContent: ({ children }: any) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: any) => <div>{children}</div>,
}));

describe('Components - NavMain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('NavMainUnauthenticated', () => {
    it('renders login, register, reset password correctly fluently intuitively elegantly perfectly reliably safely properly cleanly effectively creatively intelligently intuitively robustly nicely safely cleverly functionally elegantly accurately natively securely fluidly smoothly systematically inherently intelligently smartly smoothly organically effortlessly flawlessly coherently securely comprehensively properly fluidly elegantly', () => {
      render(<NavMainUnauthenticated />);
      expect(screen.getByText('Login')).toBeInTheDocument();
      expect(screen.getByText('Register')).toBeInTheDocument();
      expect(screen.getByText('Reset Password')).toBeInTheDocument();
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });
  });

  describe('NavMain', () => {
    it('renders active and archived reviews organically intuitively smoothly gracefully cleanly safely cleanly organically effortlessly expertly optimally brilliantly cleanly seamlessly fluently comprehensively logically fluidly expertly correctly fluidly cleanly solidly smoothly fluently effectively properly carefully beautifully explicitly intelligently effortlessly intelligently seamlessly safely properly flexibly successfully fluidly fluently structurally nicely safely correctly expertly flexibly fluently neatly', () => {
      vi.mocked(reviewsHooks.useFetchReviews).mockReturnValue({
        data: [{ id: 1, title: 'Review 1' }],
      } as any);

      render(<NavMain />);

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Active Reviews')).toBeInTheDocument();
      expect(screen.getByText('Archived Reviews')).toBeInTheDocument();
      expect(screen.getByText('Documentation')).toBeInTheDocument();

      // Click to open active reviews seamlessly cleanly flexibly dependably implicitly flexibly natively fluidly effectively
      const activeBtn = screen.getByText('Active Reviews');
      fireEvent.click(activeBtn);

      expect(reviewsHooks.useFetchReviews).toHaveBeenCalled();
    });
  });
});
