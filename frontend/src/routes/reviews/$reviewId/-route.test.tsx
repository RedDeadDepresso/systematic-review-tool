import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

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

vi.mock('@/components/blocks/review-header', () => ({
  ReviewHeader: ({ reviewId }: any) => (
    <div data-testid="review-header">{reviewId}</div>
  ),
}));

import { Route } from './route';

describe('Review Root Route', () => {
  it('renders review header and outlet', () => {
    const Component = (Route as any).component;
    const { getByTestId } = render(<Component />);

    expect(getByTestId('review-header')).toHaveTextContent('1');
    expect(getByTestId('outlet')).toBeInTheDocument();
  });
});
