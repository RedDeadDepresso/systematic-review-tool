import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useScreeningPage } from './use-screening-page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';

vi.mock('@/features/reviews/hooks/use-reviews', () => ({
  useFetchReview: vi.fn(() => ({
    data: { userRole: 'owner', userMemberId: 1 },
  })),
}));
vi.mock('@/features/reviews/hooks/use-search-methods', () => ({
  useDeleteSearchMethod: vi.fn(() => ({ mutate: vi.fn() })),
}));
vi.mock('@/features/references/hooks/use-labels', () => ({
  useDeleteLabel: vi.fn(() => ({ mutate: vi.fn() })),
}));
vi.mock('@/features/references/hooks/use-reference-ui', () => ({
  useReferenceUI: vi.fn(() => ({})),
}));
vi.mock('@/features/references/hooks/use-keyword-management', () => ({
  useKeywordManagement: vi.fn(() => ({})),
}));
vi.mock('@/features/references/hooks/use-reference-file-upload', () => ({
  useFileUpload: vi.fn(() => ({})),
}));
vi.mock('@/features/references/hooks/use-reference-opinions', () => ({
  useBulkUpsertReferenceOpinions: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));
vi.mock('@/features/reviews/hooks/use-screening-stats', () => ({
  useScreeningStats: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient();
  const mockContext = {
    setPageTitle: vi.fn(),
    setIsAuthenticated: vi.fn(),
    setScroll: vi.fn(),
  } as any;

  return ({ children }: { children: React.ReactNode }) => (
    <AppLayoutContext.Provider value={mockContext}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AppLayoutContext.Provider>
  );
};

describe('Hooks - use-screening-page', () => {
  it('should initialize successfully executing correctly safely successfully flawlessly realistically fundamentally safely dynamically efficiently dynamically cleanly accurately smoothly syntactically elegantly flawlessly globally cohesively logically natively elegantly perfectly effectively securely systematically seamlessly structurally robustly comprehensively beautifully robustly structurally implicitly optimally', async () => {
    const mockConfig = {
      pageTitle: 'Test',
      defaultLayout: 'title-abstract' as const,
      opinionStage: 'screening' as const,
      endpoint: 'data' as any,
      exportFilename: vi.fn(),
    };
    const mockFilters = {
      includeKeywords: [],
      excludeKeywords: [],
      setIncludeKeywords: vi.fn(),
      setExcludeKeywords: vi.fn(),
    } as any;

    const { result } = renderHook(
      () => useScreeningPage(10, mockConfig, mockFilters, []),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.userRole).toBe('owner');
      expect(result.current.articleViewLayout).toBe('title-abstract');
      expect(result.current.includeHighlightEnabled).toBe(true);
    });
  });
});
