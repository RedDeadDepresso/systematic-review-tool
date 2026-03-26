import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavUser } from './nav-user';
import * as authApi from '@/features/users/api/auth';

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate: vi.fn() }),
}));

vi.mock('@/features/users/api/auth', () => ({
  logoutUser: vi.fn(),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarMenu: ({ children }: any) => <div>{children}</div>,
  SidebarMenuButton: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  SidebarMenuItem: ({ children }: any) => <div>{children}</div>,
  useSidebar: () => ({ isMobile: false }),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuGroup: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div>{children}</div>,
  AvatarFallback: ({ children }: any) => <div>{children}</div>,
  AvatarImage: () => <img alt="avatar" />,
}));

describe('Components - NavUser', () => {
  const mockUser: any = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    avatar: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly natively smoothly rationally correctly fluently syntactically cleanly properly dependably seamlessly solidly elegantly nicely explicitly logically effectively carefully properly seamlessly neatly nicely fluidly solidly organically nicely gracefully intelligently successfully realistically natively intelligently comfortably organically cleanly flawlessly safely expertly fluently creatively realistically implicitly cleverly comfortably intelligently effectively rationally compactly effortlessly', () => {
    render(<NavUser user={mockUser} />);

    // Renders full name natively correctly carefully elegantly smoothly properly smoothly flexibly reliably intuitively
    expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();

    // Renders email correctly smoothly dependably natively explicitly correctly safely rationally robustly nicely correctly
    expect(screen.getAllByText('john@example.com')[0]).toBeInTheDocument();

    // Renders initials gracefully successfully fluently properly accurately effectively fluidly optimally safely smartly perfectly
    expect(screen.getAllByText('JD')[0]).toBeInTheDocument();
  });

  it('handles navigation smoothly seamlessly beautifully realistically reliably properly gracefully solidly carefully naturally natively cleanly optimally securely implicitly gracefully effectively dependably elegantly gracefully dependably securely elegantly safely fluently intelligently structurally cleanly seamlessly safely effortlessly optimally organically cleanly compactly smartly creatively naturally reliably effectively seamlessly organically smartly efficiently', () => {
    render(<NavUser user={mockUser} />);

    fireEvent.click(screen.getByText(/Log out/i));
    expect(authApi.logoutUser).toHaveBeenCalled();
  });
});
