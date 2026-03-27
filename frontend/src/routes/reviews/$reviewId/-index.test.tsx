import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppLayoutContext } from '@/context/app-layout-context';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (path: string) => (config: any) => ({
    path,
    ...config,
    useParams: () => ({ reviewId: '1' }),
  }),
  Link: ({ children }: any) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
  useRouterState: () => ({ location: { pathname: '/' } }),
  useRouteContext: () => ({}),
  useSearch: () => ({}),
  Outlet: () => <div data-testid="outlet" />,
  redirect: vi.fn(),
}));

vi.mock('@/features/reviews/hooks/use-reviews', () => ({
  useFetchReview: () => ({
    data: {
      reviewId: 1,
      title: 'Test Review',
      userRole: 'owner',
      duplicateDetectionStatus: 'completed',
    },
    isLoading: false,
  }),
  useUploadReviewReferences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDetectDuplicateReferences: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/features/reviews/hooks/use-review-members', () => ({
  useFetchReviewMembers: () => ({ data: [], isLoading: false }),
}));

// Mock subcomponents
vi.mock('@/features/integrations/components/zotero/zotero-sync-panel', () => ({
  ZoteroSyncPanel: () => null,
}));
vi.mock('@/components/blocks/file-upload-dialog', () => ({
  FileUploadDialog: () => null,
}));
vi.mock(
  '@/features/reviews/components/review-members/review-members-table',
  () => ({ ReviewMembersTable: () => null })
);
vi.mock(
  '@/features/reviews/components/screening-criteria/screening-criteria-card',
  () => ({ ScreeningCriteriaCard: () => null })
);
vi.mock('@/features/reviews/components/screening-stats/stats-section', () => ({
  StatsSection: () => null,
}));
vi.mock(
  '@/features/references/components/reference-clusters/resolve-duplicates-dialog',
  () => ({ ResolveDuplicatesDialog: () => null })
);

import { Route } from './index';

describe('Review Index Route', () => {
  it('renders review page overview and sets context', () => {
    const Component = (Route as any).component;

    const contextValue = {
      setPageTitle: vi.fn(),
      setIsAuthenticated: vi.fn(),
      setScroll: vi.fn(),
    } as any;

    render(
      <AppLayoutContext.Provider value={contextValue}>
        <Component />
      </AppLayoutContext.Provider>
    );

    expect(screen.getByText('Review Info')).toBeInTheDocument();
    expect(screen.getByText('Data Summary')).toBeInTheDocument();
    expect(screen.getByText('Test Review')).toBeInTheDocument();
  });
});
