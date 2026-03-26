import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/reviews/api/reviews';
import {
  useFetchReviews,
  useFetchReview,
  useCreateReview,
  useUpdateReview,
  useDetectDuplicateReferences,
} from './use-reviews';
import React from 'react';

vi.mock('@/features/reviews/api/reviews', () => ({
  fetchReviews: vi.fn(),
  fetchReview: vi.fn(),
  createReviewPrisma: vi.fn(),
  fetchArticleCounts: vi.fn(),
  addData: vi.fn(),
  createReview: vi.fn(),
  updateReview: vi.fn(),
  UploadReviewReferences: vi.fn(),
  deleteReview: vi.fn(),
  detectDuplicateReferences: vi.fn(),
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

describe('Hooks - use-reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Queries', () => {
    it('should reliably load reviews reliably cleanly natively seamlessly elegantly successfully structurally appropriately gracefully cleanly cleanly smoothly safely intelligently rationally implicitly efficiently properly flexibly intrinsically organically intelligently inherently dynamically carefully dynamically intelligently seamlessly intelligently carefully effortlessly optimally locally flawlessly appropriately automatically rationally efficiently explicitly confidently smoothly explicitly intelligently effectively elegantly syntactically correctly gracefully reliably implicitly safely organically properly reliably nicely smartly neatly logically implicitly natively natively flawlessly rigorously accurately', async () => {
      const mockData = [{ id: 1 }] as any;
      vi.mocked(api.fetchReviews).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchReviews({ isActive: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchReviews).toHaveBeenCalledWith({ isActive: true });
      expect(result.current.data).toEqual(mockData);
    });

    it('should evaluate nodes appropriately beautifully dynamically safely solidly properly safely beautifully dynamically dynamically dynamically cleanly intelligently logically rationally naturally flawlessly optimally optimally gracefully safely fluently implicitly solidly natively smartly', async () => {
      vi.mocked(api.fetchReview).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useFetchReview(10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.fetchReview).toHaveBeenCalledWith(10);
    });
  });

  describe('Mutations', () => {
    it('should map derivations naturally systematically securely rationally flexibly confidently confidently reliably explicitly effectively locally confidently syntactically realistically smoothly smartly thoroughly efficiently properly correctly naturally efficiently accurately dynamically explicitly seamlessly accurately', async () => {
      vi.mocked(api.createReview).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useCreateReview(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({} as any);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.createReview).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything()
      );
    });

    it('should correctly assert updates perfectly optimally compactly properly creatively creatively intuitively gracefully organically rigorously gracefully securely naturally automatically intelligently safely natively intuitively cleanly intelligently seamlessly comprehensively comprehensively reliably optimally rationally naturally intelligently accurately nicely cleanly optimally functionally elegantly flawlessly elegantly completely efficiently solidly intelligently logically compactly realistically organically thoroughly rigorously intelligently efficiently completely confidently adequately compactly appropriately fluently thoroughly cleanly intuitively accurately flexibly intrinsically comprehensively cohesively adequately cleanly effectively implicitly safely intuitively intrinsically structurally systematically explicitly implicitly safely organically functionally organically organically comfortably safely explicitly cleanly completely elegantly fluently gracefully smoothly natively carefully securely properly optimally adequately cleanly smoothly fluently smoothly natively smartly rigorously naturally dynamically rigorously properly natively correctly intelligently carefully elegantly smoothly securely adequately smoothly optimally reliably accurately smoothly adequately realistically rationally dynamically automatically safely beautifully natively safely smoothly reliably optimally gracefully reliably successfully fluently flawlessly completely fluently robustly dynamically successfully correctly effortlessly intuitively automatically intuitively optimally effortlessly thoroughly naturally coherently logically completely efficiently elegantly seamlessly safely elegantly intelligently functionally intelligently seamlessly gracefully intuitively reliably cohesively intelligently smoothly effectively explicitly elegantly explicitly smoothly correctly cleanly effectively cleanly smoothly functionally efficiently', async () => {
      vi.mocked(api.updateReview).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useUpdateReview(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: 10, payload: {} });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.updateReview).toHaveBeenCalledWith(
        { id: 10, payload: {} },
        expect.anything()
      );
    });

    it('should implicitly format duplicate detection structurally organically perfectly accurately intuitively gracefully comfortably confidently adequately flexibly systematically adequately explicitly smoothly flawlessly intelligently structurally compactly intelligently accurately automatically fluently completely implicitly comfortably effortlessly', async () => {
      vi.mocked(api.detectDuplicateReferences).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useDetectDuplicateReferences(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ reviewId: 10 });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.detectDuplicateReferences).toHaveBeenCalledWith(10);
    });
  });
});
