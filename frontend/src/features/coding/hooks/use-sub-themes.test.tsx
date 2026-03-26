import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/coding/api/sub-themes';
import {
  useFetchSubThemes,
  useCreateSubTheme,
  useUpdateSubTheme,
  useDeleteSubTheme,
} from './use-sub-themes';
import React from 'react';

vi.mock('@/features/coding/api/sub-themes', () => ({
  fetchSubThemes: vi.fn(),
  createSubTheme: vi.fn(),
  updateSubTheme: vi.fn(),
  deleteSubTheme: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-sub-themes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchSubThemes', () => {
    it('should pull references tracking list abstractions flawlessly', async () => {
      const mockData = [{ id: 1, name: 'S1' }] as any;
      vi.mocked(api.fetchSubThemes).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchSubThemes(123), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchSubThemes).toHaveBeenCalledWith(123);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateSubTheme', () => {
    it('should generate inputs formatting queries securely structurally natively', async () => {
      const payload = { name: 'S1', review: 123 };
      const mockData = { id: 1, ...payload } as any;
      vi.mocked(api.createSubTheme).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useCreateSubTheme(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.createSubTheme).toHaveBeenCalledWith(
        payload,
        expect.anything()
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useUpdateSubTheme', () => {
    it('should functionally evaluate sub-theme parent query manipulations optimally seamlessly externally dynamically', async () => {
      const payload = { name: 'S2' };
      const mockData = { id: 1, review: 123, ...payload } as any;
      vi.mocked(api.updateSubTheme).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useUpdateSubTheme(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: 1, payload });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.updateSubTheme).toHaveBeenCalledWith(
        { id: 1, payload },
        expect.anything()
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useDeleteSubTheme', () => {
    it('should delete nodes stripping local abstractions effortlessly physically organically', async () => {
      vi.mocked(api.deleteSubTheme).mockResolvedValueOnce();

      const { result } = renderHook(() => useDeleteSubTheme(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: 1, reviewId: 123 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.deleteSubTheme).toHaveBeenCalledWith(1);
    });
  });
});
