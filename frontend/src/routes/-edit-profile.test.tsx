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

vi.mock('@/features/users/components/edit-profile-form', () => ({
  EditProfileForm: () => (
    <div data-testid="edit-profile-form">Edit Profile</div>
  ),
}));

vi.mock('@/features/users/api/auth', () => ({
  redirectUnauthenticated: vi.fn(),
}));

import { Route } from './edit-profile';

describe('Edit Profile Route', () => {
  it('has correct route configuration', () => {
    expect((Route as any).path).toBe('/edit-profile');
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

    expect(getByTestId('edit-profile-form')).toBeInTheDocument();

    expect(setPageTitle).toHaveBeenCalledWith('Edit Profile');
    expect(setIsAuthenticated).toHaveBeenCalledWith(true);
    expect(setScroll).toHaveBeenCalledWith(true);
  });
});
