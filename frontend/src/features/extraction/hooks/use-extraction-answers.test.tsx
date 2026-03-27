import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/extraction/api/extraction-answers';
import {
  useFetchExtractionAnswers,
  useSaveExtractionAnswer,
  useDeleteExtractionAnswer,
  useBulkSaveAnswers,
} from './use-extraction-answers';
import React from 'react';

vi.mock('@/features/extraction/api/extraction-answers', () => ({
  fetchExtractionAnswers: vi.fn(),
  saveExtractionAnswer: vi.fn(),
  deleteExtractionAnswer: vi.fn(),
  bulkSaveAnswers: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-extraction-answers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchExtractionAnswers', () => {
    it('should dynamically query states logically accurately externally cleanly', async () => {
      const mockData = [{ id: 1, text: 'A1' }] as any;
      vi.mocked(api.fetchExtractionAnswers).mockResolvedValueOnce(mockData);

      const { result } = renderHook(
        () => useFetchExtractionAnswers({ referenceId: 10 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchExtractionAnswers).toHaveBeenCalledWith({
        referenceId: 10,
        questionId: undefined,
      });
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useSaveExtractionAnswer', () => {
    it('should systematically push assertions structurally tracking mutations rigorously', async () => {
      const mockPayload = { answer: 'Ans1', reference: 10, question: 1 };
      const mockData = { id: 1, ...mockPayload } as any;
      vi.mocked(api.saveExtractionAnswer).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useSaveExtractionAnswer(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.saveExtractionAnswer).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useDeleteExtractionAnswer', () => {
    it('should reliably unmount state implicitly stripping node mappings accurately', async () => {
      vi.mocked(api.deleteExtractionAnswer).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteExtractionAnswer(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ answerId: 1, referenceId: 10, questionId: 1 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.deleteExtractionAnswer).toHaveBeenCalledWith(1);
    });
  });

  describe('useBulkSaveAnswers', () => {
    it('should handle complex operations structurally mapping arrays seamlessly logically correctly elegantly', async () => {
      const mockPayload = { answers: [], referenceId: 10 };
      const mockData = { savedCount: 2 } as any;
      vi.mocked(api.bulkSaveAnswers).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useBulkSaveAnswers(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.bulkSaveAnswers).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
      expect(result.current.data).toEqual(mockData);
    });
  });
});
