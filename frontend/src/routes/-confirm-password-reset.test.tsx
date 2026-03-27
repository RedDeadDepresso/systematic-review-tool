import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { redirectAuthenticated } from '@/features/users/api/auth';

vi.mock('@tanstack/react-router', () => {
  const useSearchMock = vi.fn(() => ({ uid: 'test-uid', token: 'test-token' }));
  return {
    createFileRoute: (path: string) => (config: any) => ({
      path,
      ...config,
      useSearch: useSearchMock,
    }),
    redirect: vi.fn(),
    Link: ({ children }: any) => <a>{children}</a>,
    useNavigate: () => vi.fn(),
    useRouter: () => ({ invalidate: vi.fn() }),
    useRouterState: () => ({ location: { pathname: '/' } }),
    useRouteContext: () => ({}),
    useSearch: () => ({}),
    Outlet: () => <div data-testid="outlet" />,
  };
});

vi.mock('@/features/users/components/confirm-password-reset-form', () => ({
  ConfirmPasswordResetForm: ({ uid, token }: any) => (
    <div data-testid="confirm-form">
      {uid}-{token}
    </div>
  ),
}));

vi.mock('@/features/users/api/auth', () => ({
  redirectAuthenticated: vi.fn(),
}));

import { Route } from './confirm-password-reset';

describe('Confirm Password Reset Route', () => {
  it('has correct route configuration and validation', () => {
    expect((Route as any).path).toBe('/confirm-password-reset');
    expect((Route as any).beforeLoad).toBe(redirectAuthenticated);

    // Test search params validation
    const validateSearch = (Route as any).validateSearch;
    expect(validateSearch({ uid: '123', token: 'abc' })).toEqual({
      uid: '123',
      token: 'abc',
    });
  });

  it('renders form with search params and sets context', () => {
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

    const form = getByTestId('confirm-form');
    expect(form).toBeInTheDocument();
    expect(form.textContent).toBe('test-uid-test-token');

    expect(setPageTitle).toHaveBeenCalledWith('Confirm Password Reset');
    expect(setIsAuthenticated).toHaveBeenCalledWith(false);
    expect(setScroll).toHaveBeenCalledWith(true);
  });
});
