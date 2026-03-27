import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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

vi.mock('@/features/users/components/change-password-form', () => ({
  ChangePasswordForm: () => <div data-testid="change-pwd-form">Change Pwd</div>,
}));

vi.mock('@/features/users/api/auth', () => ({
  redirectUnauthenticated: vi.fn(),
}));

import { Route } from './change-password';

describe('Change Password Route', () => {
  it('has correct route configuration', () => {
    expect((Route as any).path).toBe('/change-password');
    expect((Route as any).beforeLoad).toBe(redirectUnauthenticated);
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

    expect(getByTestId('change-pwd-form')).toBeInTheDocument();

    expect(setPageTitle).toHaveBeenCalledWith('Change Password');
    expect(setIsAuthenticated).toHaveBeenCalledWith(true);
    expect(setScroll).toHaveBeenCalledWith(true);
  });
});
