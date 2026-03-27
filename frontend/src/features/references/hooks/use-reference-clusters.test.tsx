import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/references/api/reference-clusters';
import {
  useFetchDuplicateClusters,
  useFetchDuplicateCluster,
  useFetchClusterStats,
  useResolveCluster,
  useDismissCluster,
  useAutoResolveDuplicates,
} from './use-reference-clusters';
import React from 'react';

vi.mock('@/features/references/api/reference-clusters', () => ({
  fetchDuplicateClusters: vi.fn(),
  fetchDuplicateCluster: vi.fn(),
  fetchClusterStats: vi.fn(),
  resolveCluster: vi.fn(),
  dismissCluster: vi.fn(),
  autoResolveDuplicates: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-reference-clusters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Queries', () => {
    it('should retrieve list dynamically adequately optimally', async () => {
      const mockData = { items: [] } as any;
      vi.mocked(api.fetchDuplicateClusters).mockResolvedValueOnce(mockData);

      const { result } = renderHook(
        () => useFetchDuplicateClusters({ reviewId: 10 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchDuplicateClusters).toHaveBeenCalledWith({ reviewId: 10 });
    });

    it('should map singular nodes naturally explicitly precisely', async () => {
      vi.mocked(api.fetchDuplicateCluster).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useFetchDuplicateCluster('c1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.fetchDuplicateCluster).toHaveBeenCalledWith('c1');
    });

    it('should reliably load aggregate parameters explicitly systematically', async () => {
      vi.mocked(api.fetchClusterStats).mockResolvedValueOnce({} as any);

      const { result } = renderHook(
        () => useFetchClusterStats({ reviewId: 10 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.fetchClusterStats).toHaveBeenCalledWith(10);
    });
  });

  describe('Mutations', () => {
    it('should orchestrate cluster derivations accurately logically confidently seamlessly appropriately effectively implicitly securely', async () => {
      vi.mocked(api.resolveCluster).mockResolvedValueOnce({
        message: 'done',
        clusterId: 'c1',
        canonicalReferenceId: 2,
      });

      const { result } = renderHook(() => useResolveCluster(10), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ clusterId: 'c1', canonicalReferenceId: 2 });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.resolveCluster).toHaveBeenCalledWith('c1', 2);
    });

    it('should naturally detach targets seamlessly gracefully natively elegantly successfully correctly', async () => {
      vi.mocked(api.dismissCluster).mockResolvedValueOnce({
        message: 'done',
        clusterId: 'c1',
      });

      const { result } = renderHook(() => useDismissCluster(10), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ clusterId: 'c1' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.dismissCluster).toHaveBeenCalledWith('c1');
    });

    it('should correctly configure batch mappings perfectly effortlessly cohesively systematically explicitly', async () => {
      vi.mocked(api.autoResolveDuplicates).mockResolvedValueOnce({
        message: 'done',
        taskId: 't1',
        status: 'pending',
        confidenceThreshold: 0.8,
        fuzzyThreshold: 0.8,
        doiClustersAlways: true,
        preferredSearchMethodId: 1,
      });

      const { result } = renderHook(() => useAutoResolveDuplicates(10), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ status: 'unresolved' } as any);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.autoResolveDuplicates).toHaveBeenCalledWith(10, {
        status: 'unresolved',
      });
    });
  });
});
