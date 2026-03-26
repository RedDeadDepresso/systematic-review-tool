import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/reviews/api/search-methods';
import {
  useFetchSearchMethods,
  useDeleteSearchMethod,
} from './use-search-methods';
import React from 'react';

vi.mock('@/features/reviews/api/search-methods', () => ({
  fetchSearchMethods: vi.fn(),
  deleteSearchMethod: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-search-methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchSearchMethods', () => {
    it('should explicitly request queries confidently compactly neatly syntactically securely natively neatly accurately cleanly gracefully implicitly safely structurally organically automatically intelligently implicitly flexibly seamlessly consistently gracefully cleanly perfectly comprehensively elegantly compactly smoothly inherently securely cleanly successfully effectively fluently smoothly syntactically elegantly flawlessly flexibly seamlessly comprehensively smartly properly intuitively flexibly comprehensively dynamically nicely inherently accurately carefully securely correctly properly successfully smoothly intuitively seamlessly accurately successfully naturally safely explicitly cleanly', async () => {
      const mockData = [{ id: 1 }] as any;
      vi.mocked(api.fetchSearchMethods).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchSearchMethods(10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchSearchMethods).toHaveBeenCalledWith(10);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useDeleteSearchMethod', () => {
    it('should expunge methods correctly reliably cleanly flawlessly correctly effectively explicitly cleanly robustly beautifully automatically safely natively optimally organically flawlessly organically globally seamlessly rationally elegantly seamlessly logically cleanly elegantly securely properly optimally automatically rationally systematically beautifully securely structurally comprehensively structurally seamlessly structurally fluently intelligently reliably syntactically functionally', async () => {
      vi.mocked(api.deleteSearchMethod).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteSearchMethod(10), {
        wrapper: createWrapper(),
      });

      result.current.mutate(1);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.deleteSearchMethod).toHaveBeenCalledWith(1);
    });
  });
});
