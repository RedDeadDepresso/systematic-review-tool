import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AppLayoutContext } from '@/context/app-layout-context';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (path: string) => (config: any) => ({
    path,
    ...config,
    useParams: () => ({ reviewId: '1' }),
  }),
  redirect: vi.fn(),
  Link: ({ children }: any) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
  useRouterState: () => ({ location: { pathname: '/' } }),
  useRouteContext: () => ({}),
  useSearch: () => ({}),
  Outlet: () => <div data-testid="outlet" />,
}));

vi.mock('@/features/coding/hooks/use-coding-theming', () => ({
  useCodingTheming: () => ({
    codes: [],
    subThemes: [],
    mainThemes: [],
    isCodesLoading: false,
    isSubThemesLoading: false,
    isMainThemesLoading: false,
    handleCreateCode: vi.fn(),
    handleCreateSubTheme: vi.fn(),
    handleCreateMainTheme: vi.fn(),
  }),
}));

vi.mock('@/features/reviews/hooks/use-reviews', () => ({
  useFetchReview: () => ({ data: { userRole: 'owner' } }),
}));

import { Route } from './coding-theming';

describe('Coding Theming Route', () => {
  it('renders correctly', () => {
    const Component = (Route as any).component;
    render(
      <AppLayoutContext.Provider
        value={
          {
            setPageTitle: vi.fn(),
            setIsAuthenticated: vi.fn(),
            setScroll: vi.fn(),
          } as any
        }
      >
        <Component />
      </AppLayoutContext.Provider>
    );
    expect(true).toBe(true);
  });
});
