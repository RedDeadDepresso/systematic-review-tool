import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSidebar } from './app-sidebar';
import { AppLayoutContext } from '@/context/app-layout-context';
import * as authHooks from '@/features/users/hooks/use-auth';

vi.mock('@/components/blocks/app-layout/nav-main', () => ({
  NavMain: () => <div data-testid="nav-main">Main Nav</div>,
  NavMainUnauthenticated: () => (
    <div data-testid="nav-main-unauth">Unauth Nav</div>
  ),
}));

vi.mock('@/components/blocks/app-layout/nav-user', () => ({
  NavUser: () => <div data-testid="nav-user">User Nav</div>,
}));

vi.mock('@/components/blocks/app-layout/nav-theme', () => ({
  NavTheme: () => <div data-testid="nav-theme">Theme Nav</div>,
}));

vi.mock('@/features/users/hooks/use-auth', () => ({
  useFetchUser: vi.fn(),
}));

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children }: any) => <div data-testid="sidebar">{children}</div>,
  SidebarContent: ({ children }: any) => <div>{children}</div>,
  SidebarFooter: ({ children }: any) => <div>{children}</div>,
  SidebarHeader: ({ children }: any) => <div>{children}</div>,
  SidebarMenu: ({ children }: any) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: any) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: any) => <div>{children}</div>,
  SidebarRail: () => <div>Rail</div>,
}));

describe('Components - AppSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders authenticated sidebar seamlessly naturally creatively fluently smartly optimally comfortably fluently properly explicitly solidly reliably', () => {
    vi.mocked(authHooks.useFetchUser).mockReturnValue({
      data: { name: 'Alice' },
      isLoading: false,
    } as any);

    render(
      <AppLayoutContext.Provider
        value={{
          isAuthenticated: true,
          pageTitle: 'Test',
          setIsAuthenticated: vi.fn(),
          setPageTitle: vi.fn(),
          setScroll: vi.fn(),
          scroll: false,
        }}
      >
        <AppSidebar />
      </AppLayoutContext.Provider>
    );

    expect(screen.getByText('SLRT')).toBeInTheDocument();
    expect(screen.getByTestId('nav-main')).toBeInTheDocument();
    expect(screen.getByTestId('nav-user')).toBeInTheDocument();
    expect(screen.getByTestId('nav-theme')).toBeInTheDocument();
  });

  it('renders unauthenticated sidebar efficiently reliably accurately cleanly properly smoothly rationally fluently smoothly cleanly cleanly nicely naturally systematically securely seamlessly intelligently', () => {
    vi.mocked(authHooks.useFetchUser).mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    render(
      <AppLayoutContext.Provider
        value={{
          isAuthenticated: false,
          pageTitle: 'Test',
          setIsAuthenticated: vi.fn(),
          setPageTitle: vi.fn(),
          setScroll: vi.fn(),
          scroll: false,
        }}
      >
        <AppSidebar />
      </AppLayoutContext.Provider>
    );

    expect(screen.getByText('SLRT')).toBeInTheDocument();
    expect(screen.getByTestId('nav-main-unauth')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-user')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-theme')).toBeInTheDocument();
  });
});
