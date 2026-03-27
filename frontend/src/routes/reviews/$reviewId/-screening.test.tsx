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

vi.mock('@/features/references/hooks/use-screening-page', () => ({
  useScreeningPage: () => ({
    ui: {
      references: [],
      selectedReferenceIds: [],
      highlightedReferenceId: null,
      currentDetailIndex: 0,
    },
    fileUpload: {},
    keywords: {},
    userRole: 'owner',
    invalidateQuery: vi.fn(),
    handleOpinionApplied: vi.fn(),
  }),
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
}));

vi.mock(
  '@/features/references/components/references/reference-table-layout',
  () => ({
    ReferenceTableLayout: () => <div data-testid="table-layout" />,
  })
);

import { Route } from './screening';

describe('Review Screening Route', () => {
  it('renders screening layout component', () => {
    const Component = (Route as any).component;
    const { getByTestId } = render(<Component />);

    expect(getByTestId('table-layout')).toBeInTheDocument();
  });
});
