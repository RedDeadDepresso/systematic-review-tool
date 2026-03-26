import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/coding/api/codes';
import {
  useFetchCodes,
  useCreateCode,
  useUpdateCode,
  useDeleteCode,
} from './use-codes';
import React from 'react';

vi.mock('@/features/coding/api/codes', () => ({
  fetchCodes: vi.fn(),
  createCode: vi.fn(),
  updateCode: vi.fn(),
  deleteCode: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-codes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchCodes', () => {
    it('should query and return fetch api results successfully natively', async () => {
      const mockData = [{ id: '1', name: 'Code 1' }] as any;
      vi.mocked(api.fetchCodes).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchCodes(123), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchCodes).toHaveBeenCalledWith(123);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateCode', () => {
    it('should mutate mapping new references tracking correctly cleanly', async () => {
      const mockPayload = { name: 'New', review: 123 };
      const mockData = { id: '2', ...mockPayload } as any;
      vi.mocked(api.createCode).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useCreateCode(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.createCode).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useUpdateCode', () => {
    it('should trigger update logic mapping seamlessly organically', async () => {
      const payload = { name: 'Updated' };
      const mockData = { id: '1', review: 123, ...payload } as any;
      vi.mocked(api.updateCode).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useUpdateCode(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: '1', payload });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.updateCode).toHaveBeenCalledWith(
        { id: '1', payload },
        expect.anything()
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useDeleteCode', () => {
    it('should properly delegate delete endpoints natively', async () => {
      vi.mocked(api.deleteCode).mockResolvedValueOnce();

      const { result } = renderHook(() => useDeleteCode(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: '1', reviewId: 123 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.deleteCode).toHaveBeenCalledWith('1');
    });
  });
});
