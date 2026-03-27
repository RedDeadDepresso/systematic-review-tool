import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { redirectAuthenticated } from '@/features/users/api/auth';

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

vi.mock('@/features/users/components/request-password-reset-form', () => ({
  RequestPasswordResetForm: () => (
    <div data-testid="reset-form">Reset Form</div>
  ),
}));

vi.mock('@/features/users/api/auth', () => ({
  redirectAuthenticated: vi.fn(),
}));

import { Route } from './request-password-reset';

describe('Request Password Reset Route', () => {
  it('has correct route configuration', () => {
    expect((Route as any).path).toBe('/request-password-reset');
    expect((Route as any).beforeLoad).toBe(redirectAuthenticated);
  });

  it('renders form and sets app layout context', () => {
    const Component = (Route as any).component;

    const setPageTitle = vi.fn();
    const setIsAuthenticated = vi.fn();
    const setScroll = vi.fn();

    const contextValue = { setPageTitle, setIsAuthenticated, setScroll } as any;

    const { getByTestId } = render(
      <AppLayoutContext.Provider value={contextValue}>
        <Component />
      </AppLayoutContext.Provider>
    );

    expect(getByTestId('reset-form')).toBeInTheDocument();

    expect(setPageTitle).toHaveBeenCalledWith('Request Password Reset');
    expect(setIsAuthenticated).toHaveBeenCalledWith(false);
    expect(setScroll).toHaveBeenCalledWith(true);
  });
});
