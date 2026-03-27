import { describe, it, vi } from 'vitest';
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

vi.mock('@/features/reviews/hooks/use-reviews', () => ({
  useCreateReviewPrisma: () => ({
    data: { data: { included: { studies: 5 } }, fileUrl: 'url' },
    isLoading: false,
    error: null,
  }),
}));

import { Route } from './prisma';

describe('Prisma Route', () => {
  it('renders prisma diagram component', () => {
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
  });
});
