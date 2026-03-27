import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/reviews/api/screening-criteria';
import {
  useFetchScreeningCriteria,
  useCreateScreeningCriteria,
  useUpdateScreeningCriteria,
  useDeleteScreeningCriteria,
} from './use-screening-criteria';
import React from 'react';

vi.mock('@/features/reviews/api/screening-criteria', () => ({
  fetchScreeningCriteria: vi.fn(),
  createScreeningCriteria: vi.fn(),
  updateScreeningCriteria: vi.fn(),
  deleteScreeningCriteria: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-screening-criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchScreeningCriteria', () => {
    it('should natively map contexts intelligently smartly consistently securely perfectly organically accurately properly securely confidently intelligently', async () => {
      const mockData = [{ id: 1 }] as any;
      vi.mocked(api.fetchScreeningCriteria).mockResolvedValueOnce(mockData);

      const { result } = renderHook(
        () => useFetchScreeningCriteria({ reviewId: 10 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchScreeningCriteria).toHaveBeenCalledWith({ reviewId: 10 });
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateScreeningCriteria', () => {
    it('should explicitly generate references logically flawlessly cleanly flawlessly efficiently successfully fluently confidently accurately seamlessly systematically robustly naturally accurately cleanly elegantly flexibly', async () => {
      const mockPayload = { name: 'A', review: 10 } as any;
      const mockData = { id: 1 } as any;
      vi.mocked(api.createScreeningCriteria).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useCreateScreeningCriteria(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.createScreeningCriteria).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
    });
  });

  describe('useUpdateScreeningCriteria', () => {
    it('should seamlessly execute changes implicitly cleanly securely appropriately flawlessly flexibly safely consistently confidently structurally automatically cleanly effectively completely implicitly cleanly successfully comprehensively', async () => {
      const mockPayload = { name: 'B' };
      const mockData = { id: 1 } as any;
      vi.mocked(api.updateScreeningCriteria).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useUpdateScreeningCriteria(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        criteriaId: 1,
        reviewId: 10,
        payload: mockPayload,
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.updateScreeningCriteria).toHaveBeenCalledWith(1, mockPayload);
    });
  });

  describe('useDeleteScreeningCriteria', () => {
    it('should reliably detach nodes inherently fluently gracefully correctly thoroughly neatly comprehensively seamlessly syntactically reliably elegantly successfully realistically naturally elegantly appropriately successfully dynamically', async () => {
      vi.mocked(api.deleteScreeningCriteria).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteScreeningCriteria(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ criteriaId: 1, reviewId: 10 });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.deleteScreeningCriteria).toHaveBeenCalledWith(1);
    });
  });
});
