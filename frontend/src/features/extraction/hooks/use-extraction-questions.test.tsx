import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/extraction/api/extraction-questions';
import {
  useFetchExtractionQuestions,
  useCreateExtractionQuestion,
  useUpdateExtractionQuestion,
  useDeleteExtractionQuestion,
} from './use-extraction-questions';
import React from 'react';

vi.mock('@/features/extraction/api/extraction-questions', () => ({
  fetchExtractionQuestions: vi.fn(),
  createExtractionQuestion: vi.fn(),
  updateExtractionQuestion: vi.fn(),
  deleteExtractionQuestion: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-extraction-questions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchExtractionQuestions', () => {
    it('should retrieve list querying dynamically naturally logically', async () => {
      const mockData = [{ id: 1, text: 'Q1' }] as any;
      vi.mocked(api.fetchExtractionQuestions).mockResolvedValueOnce(mockData);

      const { result } = renderHook(
        () => useFetchExtractionQuestions({ reviewId: 10 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchExtractionQuestions).toHaveBeenCalledWith({
        reviewId: 10,
        sectionId: undefined,
        type: undefined,
      });
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateExtractionQuestion', () => {
    it('should generate mutations validating structurally optimally', async () => {
      const mockPayload = { question: 'Q1', section: 1 };
      const mockData = { id: 1, ...mockPayload } as any;
      vi.mocked(api.createExtractionQuestion).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useCreateExtractionQuestion(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.createExtractionQuestion).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useUpdateExtractionQuestion', () => {
    it('should natively configure payloads updating correctly mapping schemas structurally', async () => {
      const mockPayload = { question: 'Q2' };
      const mockData = { id: 1, section: 1, ...mockPayload } as any;
      vi.mocked(api.updateExtractionQuestion).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useUpdateExtractionQuestion(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ questionId: 1, payload: mockPayload as any });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.updateExtractionQuestion).toHaveBeenCalledWith(1, mockPayload);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useDeleteExtractionQuestion', () => {
    it('should decouple structures inherently removing local derivations cleanly intuitively', async () => {
      vi.mocked(api.deleteExtractionQuestion).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteExtractionQuestion(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ questionId: 1, sectionId: 1 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.deleteExtractionQuestion).toHaveBeenCalledWith(1);
    });
  });
});
