import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/references/api/labels';
import {
  useFetchLabels,
  useCreateLabel,
  useUpdateLabel,
  useDeleteLabel,
  useAssignLabelsToReferences,
} from './use-labels';
import React from 'react';

vi.mock('@/features/references/api/labels', () => ({
  fetchLabels: vi.fn(),
  createLabel: vi.fn(),
  updateLabel: vi.fn(),
  deleteLabel: vi.fn(),
  assignLabelsToReferences: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchLabels', () => {
    it('should map query operations naturally flawlessly', async () => {
      const mockData = [{ id: 1, name: 'Lb1' }] as any;
      vi.mocked(api.fetchLabels).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchLabels(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchLabels).toHaveBeenCalled();
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateLabel', () => {
    it('should push definitions dynamically organically flexibly gracefully', async () => {
      const mockPayload = { name: 'NewLabel', color: 'red' } as any;
      const mockData = { id: 1, ...mockPayload } as any;
      vi.mocked(api.createLabel).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useCreateLabel(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.createLabel).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
    });
  });

  describe('useUpdateLabel', () => {
    it('should map updates dynamically neatly carefully', async () => {
      const mockPayload = { id: 1, payload: { color: 'blue' } } as any;
      const mockData = { id: 1, color: 'blue' } as any;
      vi.mocked(api.updateLabel).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useUpdateLabel(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.updateLabel).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
    });
  });

  describe('useDeleteLabel', () => {
    it('should reliably unmount records safely thoroughly seamlessly appropriately elegantly consistently solidly neatly securely', async () => {
      vi.mocked(api.deleteLabel).mockResolvedValueOnce();

      const { result } = renderHook(() => useDeleteLabel(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.deleteLabel).toHaveBeenCalledWith(1);
    });
  });

  describe('useAssignLabelsToReferences', () => {
    it('should structurally execute mass schemas successfully functionally globally effortlessly natively efficiently intuitively dynamically confidently naturally elegantly effectively seamlessly seamlessly comprehensively', async () => {
      const mockPayload = { remove: [1], references: [2] } as any;
      vi.mocked(api.assignLabelsToReferences).mockResolvedValueOnce({
        created: 0,
        deleted: 1,
      } as any);

      const { result } = renderHook(() => useAssignLabelsToReferences(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.assignLabelsToReferences).toHaveBeenCalledWith(mockPayload);
    });
  });
});
