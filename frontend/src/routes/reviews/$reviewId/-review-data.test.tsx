import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

vi.mock('@/features/references/hooks/use-reference-filters', () => ({
  useReferenceFilters: () => ({
    filters: {},
    publicationTypes: [],
    publicationYears: [],
    fileStatus: 'all',
    assigneeIds: [],
    includeKeywords: [],
    excludeKeywords: [],
    labelIds: [],
  }),
}));

vi.mock('@/features/references/hooks/use-references', () => ({
  useFetchReferences: () => ({ data: {}, isLoading: false }),
  useFetchFilterCounts: () => ({ data: {} }),
  selectFlatReferences: () => [],
  selectPageMeta: () => ({ totalCount: 0, filteredCount: 0 }),
  useAssignReferences: () => ({ mutate: vi.fn(), isPending: false }),
  referenceKeys: { filterCounts: vi.fn() },
}));

vi.mock('@/features/reviews/hooks/use-reviews', () => ({
  useFetchReview: () => ({ data: { userRole: 'owner' } }),
}));

vi.mock('@/features/references/hooks/use-reference-ui', () => ({
  useReferenceUI: () => ({
    selectedReferenceIds: [],
    highlightedReferenceId: null,
    references: [],
  }),
}));

vi.mock('@/features/references/hooks/use-keyword-management', () => ({
  useKeywordManagement: () => ({ includeKeywords: [], excludeKeywords: [] }),
}));

vi.mock('@/features/references/hooks/use-reference-file-upload', () => ({
  useFileUpload: () => ({}),
}));

vi.mock(
  '@/features/references/components/references/reference-table-layout',
  () => ({
    ReferenceTableLayout: () => <div data-testid="table-layout" />,
  })
);

import { Route } from './review-data';

describe('Review Data Route', () => {
  it('renders layout correctly', () => {
    const Component = (Route as any).component;
    const queryClient = new QueryClient();
    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    );
    expect(getByTestId('table-layout')).toBeInTheDocument();
  });
});
