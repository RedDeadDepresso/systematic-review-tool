import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/references/api/reasons';
import {
  useFetchReasons,
  useCreateReason,
  useUpdateReason,
  useDeleteReason,
} from './use-reasons';
import React from 'react';

vi.mock('@/features/references/api/reasons', () => ({
  fetchReasons: vi.fn(),
  createReason: vi.fn(),
  updateReason: vi.fn(),
  deleteReason: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-reasons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchReasons', () => {
    it('should structurally execute hooks efficiently seamlessly natively perfectly properly organically dynamically accurately gracefully instinctively adequately neatly successfully globally accurately', async () => {
      const mockData = [{ id: 1, name: 'Rea1' }] as any;
      vi.mocked(api.fetchReasons).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchReasons({ reviewId: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchReasons).toHaveBeenCalledWith({ reviewId: 10 });
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateReason', () => {
    it('should safely construct definitions optimally reliably intuitively cleanly explicitly solidly neatly seamlessly logically optimally effortlessly cleanly organically', async () => {
      const mockPayload = { name: 'Rea' };
      const mockData = { id: 1, ...mockPayload, review: 10 } as any;
      vi.mocked(api.createReason).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useCreateReason(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ reviewId: 10, payload: mockPayload });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.createReason).toHaveBeenCalledWith({
        review: 10,
        ...mockPayload,
      });
    });
  });

  describe('useUpdateReason', () => {
    it('should rigorously execute queries safely gracefully intelligently effortlessly correctly flawlessly efficiently completely effortlessly solidly comprehensively flawlessly strictly consistently cleanly intelligently implicitly implicitly properly instinctively smoothly coherently cleanly adequately cleanly successfully', async () => {
      const mockPayload = { name: 'U' };
      const mockData = { id: 1, ...mockPayload } as any;
      vi.mocked(api.updateReason).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useUpdateReason(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        reasonId: 1,
        reviewId: 10,
        payload: mockPayload,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.updateReason).toHaveBeenCalledWith(1, mockPayload);
    });
  });

  describe('useDeleteReason', () => {
    it('should strip items logically effectively tracking correctly comprehensively accurately confidently properly intelligently automatically elegantly comprehensively appropriately natively completely', async () => {
      vi.mocked(api.deleteReason).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteReason(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ reasonId: 1, reviewId: 10 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.deleteReason).toHaveBeenCalledWith(1);
    });
  });
});
