import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { redirectAuthenticated } from '@/features/users/api/auth';

// Mock tanstack router
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

// Mock the form component
vi.mock('@/features/users/components/login-form', () => ({
  LoginForm: () => <div data-testid="login-form">Login Form</div>,
}));

// Mock redirect logic
vi.mock('@/features/users/api/auth', () => ({
  redirectAuthenticated: vi.fn(),
}));

// Import after mocks
import { Route } from './login';

describe('Login Route', () => {
  it('has correct route configuration', () => {
    expect((Route as any).path).toBe('/login');
    expect((Route as any).beforeLoad).toBe(redirectAuthenticated);
  });

  it('renders LoginForm and sets app layout context on mount', () => {
    const Component = (Route as any).component;

    const setPageTitle = vi.fn();
    const setIsAuthenticated = vi.fn();
    const setScroll = vi.fn();

    const contextValue = {
      setPageTitle,
      setIsAuthenticated,
      setScroll,
    } as any;

    const { getByTestId } = render(
      <AppLayoutContext.Provider value={contextValue}>
        <Component />
      </AppLayoutContext.Provider>
    );

    expect(getByTestId('login-form')).toBeInTheDocument();

    expect(setPageTitle).toHaveBeenCalledWith('Login');
    expect(setIsAuthenticated).toHaveBeenCalledWith(false);
    expect(setScroll).toHaveBeenCalledWith(true);
  });
});
