import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (path: string) => (config: any) => ({
    path,
    ...config,
    useLoaderData: () => ({
      Component: () => <div data-testid="doc-content">Mock Doc</div>,
    }),
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

vi.mock('@/components/blocks/docs/docs-toc', () => ({
  DocsTableOfContents: () => <div data-testid="docs-toc" />,
}));

vi.mock('@/hooks/use-toc', () => ({
  useTocFromContent: () => [{ title: 'h1', url: '#h1', depth: 1 }],
}));

import { Route } from './$...slug';

describe('Docs Route', () => {
  it('has correct route configuration and loader', async () => {
    expect((Route as any).path).toBe('/docs/$/slug');
    expect(typeof (Route as any).loader).toBe('function');
  });

  it('renders doc layout with TOC and Content', () => {
    const Component = (Route as any).component;
    const { getByTestId } = render(<Component />);

    expect(getByTestId('doc-content')).toBeInTheDocument();
    expect(getByTestId('docs-toc')).toBeInTheDocument();
  });
});
