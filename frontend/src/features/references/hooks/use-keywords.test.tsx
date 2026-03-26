import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/references/api/keywords';
import {
  useFetchKeywords,
  useCreateKeyword,
  useDeleteKeyword,
} from './use-keywords';
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

describe('Hooks - use-keywords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchKeywords', () => {
    it('should map query operations natively', async () => {
      const mockData = [{ id: 1, text: 'Kw1' }] as any;
      vi.mocked(api.fetchKeywords).mockResolvedValueOnce(mockData);

      const { result } = renderHook(
        () => useFetchKeywords({ reviewId: 10, type: 'inclusion' }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchKeywords).toHaveBeenCalledWith({
        reviewId: 10,
        type: 'inclusion',
      });
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateKeyword', () => {
    it('should systematically push assertions structurally tracking dynamically accurately', async () => {
      const mockPayload = {
        name: 'NewKw',
        review: 10,
        type: 'inclusion' as const,
      };
      const mockData = { id: 1, ...mockPayload } as any;
      vi.mocked(api.createKeyword).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useCreateKeyword(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Uses mutationFn: createKeyword, so expect.anything() helps
      expect(api.createKeyword).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useDeleteKeyword', () => {
    it('should gracefully expunge records cleanly stripping naturally consistently appropriately successfully elegantly', async () => {
      vi.mocked(api.deleteKeyword).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteKeyword(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ keywordId: 1, reviewId: 10, type: 'inclusion' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Mapped via arrow function without trailing args
      expect(api.deleteKeyword).toHaveBeenCalledWith(1);
    });
  });
});
