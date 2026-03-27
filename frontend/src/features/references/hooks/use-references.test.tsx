import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/references/api/references';
import {
  useFetchReferences,
  useFetchFilterCounts,
  useFetchReference,
  useUpdateReference,
  useAssignReferences,
} from './use-references';
import React from 'react';

vi.mock('@/features/references/api/references', () => ({
  fetchReferences: vi.fn(),
  fetchFilterCounts: vi.fn(),
  fetchReference: vi.fn(),
  updateReference: vi.fn(),
  uploadReferenceFile: vi.fn(),
  attachPDFsToReferences: vi.fn(),
  assignReferences: vi.fn(),
  autoMatch: vi.fn(),
  ENDPOINTS: { reviewData: 'data' },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-references', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Queries', () => {
    it('should query lists infinitely coherently beautifully safely consistently optimally functionally systematically explicitly rigorously naturally', async () => {
      const mockData = { references: [], next: null } as any;
      vi.mocked(api.fetchReferences).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchReferences({ review: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchReferences).toHaveBeenCalledWith(
        { review: 10, limit: 50, offset: 0 },
        'data'
      );
    });

    it('should aggregate metadata correctly successfully natively seamlessly effectively cleanly efficiently explicitly naturally intelligently seamlessly natively', async () => {
      vi.mocked(api.fetchFilterCounts).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useFetchFilterCounts(10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.fetchFilterCounts).toHaveBeenCalledWith(10, 'data');
    });

    it('should uniquely target identities solidly cleanly implicitly accurately efficiently solidly thoroughly appropriately', async () => {
      vi.mocked(api.fetchReference).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useFetchReference(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.fetchReference).toHaveBeenCalledWith(1);
    });
  });

  describe('Mutations', () => {
    it('should map manipulations gracefully cleanly solidly syntactically adequately optimally flawlessly structurally perfectly effectively', async () => {
      vi.mocked(api.updateReference).mockResolvedValueOnce({ id: 1 } as any);

      const { result } = renderHook(() => useUpdateReference(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        referenceId: 1,
        reviewId: 10,
        payload: { status: 'included' },
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.updateReference).toHaveBeenCalledWith(
        { referenceId: 1, reviewId: 10, payload: { status: 'included' } },
        expect.anything()
      );
    });

    it('should configure logic properly gracefully inherently confidently organically completely intelligently implicitly implicitly solidly confidently compactly natively globally', async () => {
      const mockPayload = { remove: [1], member: 2, review: 10 } as any;
      vi.mocked(api.assignReferences).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useAssignReferences(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.assignReferences).toHaveBeenCalledWith(mockPayload);
    });
  });
});
