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

vi.mock(
  '@/features/extraction/components/charts/extraction-charts-dashboard',
  () => ({
    ExtractionChartsDashboard: () => <div data-testid="charts-dashboard" />,
  })
);

import { Route } from './charts';

describe('Charts Route', () => {
  it('renders charts dashboard', () => {
    const Component = (Route as any).component;
    const { getByTestId } = render(
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
    expect(getByTestId('charts-dashboard')).toBeInTheDocument();
  });
});
