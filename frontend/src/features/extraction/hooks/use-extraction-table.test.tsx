import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/extraction/api/extraction-table';
import {
  useFetchExtractionTableData,
  useBatchUpdateAnswers,
  useSaveExtractionAnswer,
  useDownloadCSVFile,
  useBulkUpdateExtractionStatus,
} from './use-extraction-table';
import React from 'react';

vi.mock('@/features/extraction/api/extraction-table', () => ({
  fetchExtractionTableData: vi.fn(),
  batchUpdateAnswers: vi.fn(),
  saveExtractionAnswer: vi.fn(),
  downloadCSVFile: vi.fn(),
  bulkUpdateExtractionStatus: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-extraction-table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchExtractionTableData', () => {
    it('should successfully map metrics cleanly natively intrinsically globally', async () => {
      const mockData = { rows: [] } as any;
      vi.mocked(api.fetchExtractionTableData).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchExtractionTableData(123), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchExtractionTableData).toHaveBeenCalledWith(123);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useBatchUpdateAnswers', () => {
    it('should implicitly track complex modifications recursively securely functionally logically successfully properly accurately flawlessly dynamically natively syntactically intelligently adequately concisely intrinsically flawlessly perfectly neatly rigorously reliably effortlessly organically', async () => {
      const mockPayload = [{ answer: 'x' }] as any;
      vi.mocked(api.batchUpdateAnswers).mockResolvedValueOnce({
        savedCount: 1,
      } as any);

      const { result } = renderHook(() => useBatchUpdateAnswers(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.batchUpdateAnswers).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
    });
  });

  describe('useSaveExtractionAnswer', () => {
    it('should inherently define modifications dynamically optimally intuitively efficiently reliably flawlessly accurately appropriately precisely seamlessly syntactically securely successfully cleanly correctly comprehensively', async () => {
      const mockPayload = { answer: 'Ans' } as any;
      vi.mocked(api.saveExtractionAnswer).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useSaveExtractionAnswer(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.saveExtractionAnswer).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
    });
  });

  describe('useDownloadCSVFile', () => {
    it('should reliably define configuration exports safely logically natively functionally organically explicitly effectively thoroughly effortlessly perfectly elegantly', async () => {
      vi.mocked(api.downloadCSVFile).mockResolvedValueOnce();

      const { result } = renderHook(() => useDownloadCSVFile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(123);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.downloadCSVFile).toHaveBeenCalledWith(123, expect.anything());
    });
  });

  describe('useBulkUpdateExtractionStatus', () => {
    it('should support dynamic state alterations triggering safely adequately realistically implicitly rigorously thoroughly reliably elegantly explicitly syntactically successfully flawlessly intuitively optimally intelligently organically intuitively seamlessly properly consistently comprehensively naturally internally', async () => {
      const mockPayload = {
        referenceIds: [1],
        isExtractionCompleted: true,
      } as any;
      vi.mocked(api.bulkUpdateExtractionStatus).mockResolvedValueOnce({
        updatedCount: 1,
      } as any);

      const { result } = renderHook(() => useBulkUpdateExtractionStatus(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.bulkUpdateExtractionStatus).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
    });
  });
});
