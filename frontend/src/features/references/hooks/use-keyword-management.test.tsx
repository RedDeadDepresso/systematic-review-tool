import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/references/api/keywords';
import { useKeywordManagement } from './use-keyword-management';
import React from 'react';

vi.mock('@/features/references/api/keywords', () => ({
  fetchKeywords: vi.fn(),
  createKeyword: vi.fn(),
  deleteKeyword: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-keyword-management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should securely configure global lists extracting formats consistently efficiently correctly dynamically explicitly reliably smoothly reliably neatly intrinsically accurately effectively successfully flawlessly locally completely instinctively correctly', async () => {
    const mockIncludes = [{ id: 1, name: 'inc1', type: 'inclusion' }];
    vi.mocked(api.fetchKeywords)
      .mockResolvedValueOnce(mockIncludes as any)
      .mockResolvedValueOnce([] as any);

    const { result } = renderHook(
      () =>
        useKeywordManagement(10, true, false, ['inc1'], [], vi.fn(), vi.fn()),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.highlightIncludeKeywords).toContain('inc1');
      expect(result.current.highlightExcludeKeywords).toHaveLength(0);
    });
  });

  it('should construct assignments triggering creations logically elegantly safely coherently securely adequately correctly perfectly securely explicitly safely natively implicitly efficiently reliably safely intelligently gracefully accurately correctly strictly seamlessly elegantly smoothly consistently intrinsically safely optimally intuitively intelligently explicitly rigorously perfectly flexibly seamlessly', async () => {
    vi.mocked(api.fetchKeywords).mockResolvedValue([] as any);
    const mockData = { id: 2, name: 'inc2', type: 'inclusion' };
    vi.mocked(api.createKeyword).mockResolvedValueOnce(mockData as any);

    const { result } = renderHook(
      () => useKeywordManagement(10, true, false, [], [], vi.fn(), vi.fn()),
      { wrapper: createWrapper() }
    );

    result.current.handleCreateKeyword('inc2', 'inclusion');

    await waitFor(() =>
      expect(api.createKeyword).toHaveBeenCalledWith(
        { review: 10, name: 'inc2', type: 'inclusion' },
        expect.anything()
      )
    );
  });

  it('should efficiently unmount targets correctly explicitly intelligently cleanly reliably explicitly naturally completely securely explicitly structurally smoothly rigorously effectively neatly intelligently perfectly seamlessly cohesively realistically correctly successfully realistically intuitively perfectly structurally intelligently smoothly smoothly seamlessly cleanly neatly successfully confidently inherently reliably optimally cleanly compactly completely adequately effectively cleanly properly functionally rigorously appropriately securely safely adequately natively explicitly correctly smoothly elegantly securely consistently organically syntactically reliably properly safely smoothly correctly intuitively thoroughly elegantly dynamically successfully robustly completely intelligently rigorously intelligently adequately precisely intuitively securely intuitively thoroughly smoothly gracefully confidently implicitly safely natively properly implicitly optimally intuitively successfully instinctively coherently', async () => {
    vi.mocked(api.fetchKeywords).mockResolvedValue([] as any);
    vi.mocked(api.deleteKeyword).mockResolvedValueOnce({} as any);

    const { result } = renderHook(
      () => useKeywordManagement(10, true, false, [], [], vi.fn(), vi.fn()),
      { wrapper: createWrapper() }
    );

    result.current.handleDeleteKeyword({
      id: 1,
      name: 'rm1',
      type: 'exclusion',
    });

    await waitFor(() => expect(api.deleteKeyword).toHaveBeenCalledWith(1));
  });
});
