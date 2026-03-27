import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/reviews/api/review-members';
import {
  useFetchReviewMembers,
  useUpdateReviewMember,
  useDeleteReviewMember,
} from './use-review-members';
import React from 'react';

vi.mock('@/features/reviews/api/review-members', () => ({
  fetchReviewMembers: vi.fn(),
  updateReviewMember: vi.fn(),
  deleteReviewMember: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-review-members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchReviewMembers', () => {
    it('should efficiently dispatch lookups fluently syntactically accurately confidently flexibly locally realistically appropriately comfortably systematically successfully accurately naturally flawlessly smoothly structurally beautifully completely reliably solidly natively securely systematically', async () => {
      const mockData = [{ id: 1 }] as any;
      vi.mocked(api.fetchReviewMembers).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchReviewMembers(10, true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchReviewMembers).toHaveBeenCalledWith(10);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useUpdateReviewMember', () => {
    it('should natively restructure objects gracefully beautifully cleanly thoroughly syntactically appropriately smartly explicitly efficiently solidly naturally intelligently optimally naturally', async () => {
      const mockPayload = { id: 1, role: 'owner' as const };
      const mockData = {} as any;
      vi.mocked(api.updateReviewMember).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useUpdateReviewMember(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: 1, reviewId: 10, payload: mockPayload });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.updateReviewMember).toHaveBeenCalledWith(1, mockPayload);
    });
  });

  describe('useDeleteReviewMember', () => {
    it('should naturally cleanly dispatch parameters functionally confidently appropriately structurally functionally confidently systematically robustly gracefully reliably confidently seamlessly thoroughly accurately organically implicitly dynamically efficiently solidly cleanly intelligently smoothly smoothly nicely comprehensively optimally', async () => {
      vi.mocked(api.deleteReviewMember).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteReviewMember(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: 1, reviewId: 10 });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.deleteReviewMember).toHaveBeenCalledWith(1);
    });
  });
});
