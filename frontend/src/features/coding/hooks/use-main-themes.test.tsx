import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/coding/api/main-themes';
import {
  useFetchMainThemes,
  useCreateMainTheme,
  useUpdateMainTheme,
  useDeleteMainTheme,
} from './use-main-themes';
import React from 'react';

vi.mock('@/features/coding/api/main-themes', () => ({
  fetchMainThemes: vi.fn(),
  createMainTheme: vi.fn(),
  updateMainTheme: vi.fn(),
  deleteMainTheme: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-main-themes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchMainThemes', () => {
    it('should query main themes natively querying APIs flawlessly', async () => {
      const mockData = [{ id: 1, name: 'M1' }] as any;
      vi.mocked(api.fetchMainThemes).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchMainThemes(123), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchMainThemes).toHaveBeenCalledWith(123);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateMainTheme', () => {
    it('should natively configure mutation updates triggering state seamlessly', async () => {
      const payload = { name: 'M', review: 123 };
      const mockData = { id: 1, ...payload } as any;
      vi.mocked(api.createMainTheme).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useCreateMainTheme(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.createMainTheme).toHaveBeenCalledWith(
        payload,
        expect.anything()
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useUpdateMainTheme', () => {
    it('should organically bind patches logically updating local queries cleanly', async () => {
      const payload = { name: 'M2' };
      const mockData = { id: 1, review: 123, ...payload } as any;
      vi.mocked(api.updateMainTheme).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useUpdateMainTheme(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: 1, payload });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.updateMainTheme).toHaveBeenCalledWith(
        { id: 1, payload },
        expect.anything()
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useDeleteMainTheme', () => {
    it('should reliably strip state queries tracking deletions synchronously locally', async () => {
      vi.mocked(api.deleteMainTheme).mockResolvedValueOnce();

      const { result } = renderHook(() => useDeleteMainTheme(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: 1, reviewId: 123 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.deleteMainTheme).toHaveBeenCalledWith(1);
    });
  });
});
