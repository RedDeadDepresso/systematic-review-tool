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

vi.mock('@/features/users/components/register-form', () => ({
  RegisterForm: () => <div data-testid="register-form">Register Form</div>,
}));

vi.mock('@/features/users/api/auth', () => ({
  redirectAuthenticated: vi.fn(),
}));

import { Route } from './register';

describe('Register Route', () => {
  it('has correct route configuration', () => {
    expect((Route as any).path).toBe('/register');
    expect((Route as any).beforeLoad).toBe(redirectAuthenticated);
  });

  it('renders RegisterForm and sets app layout context on mount', () => {
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

    expect(getByTestId('register-form')).toBeInTheDocument();

    expect(setPageTitle).toHaveBeenCalledWith('Register');
    expect(setIsAuthenticated).toHaveBeenCalledWith(false);
    expect(setScroll).toHaveBeenCalledWith(true);
  });
});
