import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { redirectUnauthenticated } from '@/features/users/api/auth';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (path: string) => (config: any) => ({ path, ...config }),
  redirect: vi.fn(),
  Link: ({ children }: any) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
  useRouterState: () => ({ location: { pathname: '/' } }),
  useRouteContext: () => ({}),
  useSearch: () => ({}),
  Outlet: () => <div data-testid="outlet" />,
}));

vi.mock('@/features/reviews/hooks/use-reviews', () => ({
  useFetchReviews: vi.fn((opts: any) => {
    if (opts.isActive) return { data: [{ id: 1 }], isLoading: false };
    return { data: [{ id: 2 }], isLoading: false };
  }),
}));

vi.mock('@/features/reviews/hooks/use-review-invitations', () => ({
  useFetchInvitations: vi.fn((type: string) => {
    if (type === 'received') return { data: [{ id: 1 }], isLoading: false };
    return { data: [{ id: 2 }], isLoading: false };
  }),
}));

vi.mock('@/features/users/api/auth', () => ({
  redirectUnauthenticated: vi.fn(),
}));

// Mock sub-components simply
vi.mock('@/features/reviews/components/reviews/reviews-table', () => ({
  ReviewsTable: () => <div data-testid="reviews-table" />,
}));
vi.mock(
  '@/features/reviews/components/review-invitations/invitations-table',
  () => ({
    ReceivedInvitationsTable: () => <div data-testid="received-table" />,
    SentInvitationsTable: () => <div data-testid="sent-table" />,
  })
);

// Mock UI components to simplify render
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <button>{children}</button>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: any) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: any) => <div>{children}</div>,
  CollapsibleContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
}));

import { Route } from './index';

describe('Index Route', () => {
  it('has correct route configuration', () => {
    expect((Route as any).path).toBe('/');
    expect((Route as any).beforeLoad).toBe(redirectUnauthenticated);
  });

  it('renders index page components and sets context', () => {
    const Component = (Route as any).component;

    const setPageTitle = vi.fn();
    const setIsAuthenticated = vi.fn();
    const setScroll = vi.fn();

    const contextValue = { setPageTitle, setIsAuthenticated, setScroll } as any;

    render(
      <AppLayoutContext.Provider value={contextValue}>
        <Component />
      </AppLayoutContext.Provider>
    );

    // Check tables rendered
    expect(screen.getByTestId('received-table')).toBeInTheDocument();
    expect(screen.getAllByTestId('reviews-table').length).toBeGreaterThan(0);

    expect(setPageTitle).toHaveBeenCalledWith('Home');
    expect(setIsAuthenticated).toHaveBeenCalledWith(true);
    expect(setScroll).toHaveBeenCalledWith(true);
  });
});
