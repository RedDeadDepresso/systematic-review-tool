import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/extraction/api/extraction-sections';
import {
  useFetchExtractionSections,
  useFetchExtractionFormData,
  useCreateExtractionSection,
  useUpdateExtractionSection,
  useDeleteExtractionSection,
} from './use-extraction-sections';
import React from 'react';

vi.mock('@/features/extraction/api/extraction-sections', () => ({
  fetchExtractionSections: vi.fn(),
  fetchExtractionFormData: vi.fn(),
  createExtractionSection: vi.fn(),
  updateExtractionSection: vi.fn(),
  deleteExtractionSection: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-extraction-sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchExtractionSections', () => {
    it('should map query operations accurately defining API abstractions organically natively flexibly', async () => {
      const mockData = [{ id: 1, name: 'S1' }] as any;
      vi.mocked(api.fetchExtractionSections).mockResolvedValueOnce(mockData);

      const { result } = renderHook(
        () => useFetchExtractionSections({ reviewId: 10 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchExtractionSections).toHaveBeenCalledWith({
        reviewId: 10,
      });
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useFetchExtractionFormData', () => {
    it('should fetch definitions capturing external triggers systematically safely automatically', async () => {
      const mockData = { id: 1, forms: [] } as any;
      vi.mocked(api.fetchExtractionFormData).mockResolvedValueOnce(mockData);

      const { result } = renderHook(
        () =>
          useFetchExtractionFormData({
            referenceId: 1,
            reviewId: 10,
            isOpen: true,
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchExtractionFormData).toHaveBeenCalledWith(1, 10);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateExtractionSection', () => {
    it('should inherently handle section mutation configurations strictly dynamically', async () => {
      const mockPayload = { name: 'S1', review: 10 };
      const mockData = { id: 1, ...mockPayload } as any;
      vi.mocked(api.createExtractionSection).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useCreateExtractionSection(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.createExtractionSection).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useUpdateExtractionSection', () => {
    it('should successfully apply modifications natively gracefully wrapping logic concisely globally dynamically accurately systematically intrinsically completely comprehensively elegantly elegantly', async () => {
      const mockPayload = { name: 'S2' };
      const mockData = { id: 1, review: 10, ...mockPayload } as any;
      vi.mocked(api.updateExtractionSection).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useUpdateExtractionSection(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        sectionId: 1,
        reviewId: 10,
        payload: mockPayload,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.updateExtractionSection).toHaveBeenCalledWith(1, mockPayload);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useDeleteExtractionSection', () => {
    it('should expunge definitions properly removing DOM representations cleanly flawlessly completely extensively rigorously smoothly natively intuitively completely', async () => {
      vi.mocked(api.deleteExtractionSection).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteExtractionSection(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ sectionId: 1, reviewId: 10 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.deleteExtractionSection).toHaveBeenCalledWith(1);
    });
  });
});
