import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@tanstack/react-router', () => ({
  createRootRoute: (config: any) => config,
  redirect: vi.fn(),
  Link: ({ children }: any) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
  useRouterState: () => ({ location: { pathname: '/' } }),
  useRouteContext: () => ({}),
  useSearch: () => ({}),
  Outlet: () => <div data-testid="outlet" />,
}));

vi.mock('sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock('@/components/blocks/app-layout/app-layout', () => ({
  AppLayout: ({ children }: any) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

import { Route } from './__root';

describe('Root Route', () => {
  it('renders Layout and Outlet', () => {
    const Component = (Route as any).component;
    const { getByTestId } = render(<Component />);

    expect(getByTestId('toaster')).toBeInTheDocument();
    expect(getByTestId('app-layout')).toBeInTheDocument();
    expect(getByTestId('outlet')).toBeInTheDocument();
  });
});
