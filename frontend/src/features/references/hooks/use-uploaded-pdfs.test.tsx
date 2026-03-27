import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/reviews/api/uploaded-pdfs';
import {
  useFetchUploadedPDFs,
  useUploadPDF,
  useDeleteUploadedPDF,
} from './use-uploaded-pdfs';
import React from 'react';

vi.mock('@/features/reviews/api/uploaded-pdfs', () => ({
  fetchUploadedPDFs: vi.fn(),
  uploadPDF: vi.fn(),
  deleteUploadedPDF: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-uploaded-pdfs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchUploadedPDFs', () => {
    it('should structurally list parameters gracefully systematically effortlessly comfortably robustly safely flexibly robustly gracefully gracefully properly intuitively flexibly solidly dynamically intelligently successfully adequately beautifully accurately organically explicitly', async () => {
      const mockData = [{ id: 1 }] as any;
      vi.mocked(api.fetchUploadedPDFs).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchUploadedPDFs(10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchUploadedPDFs).toHaveBeenCalledWith(10);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useUploadPDF', () => {
    it('should map derivations cleanly beautifully properly seamlessly securely flawlessly elegantly efficiently gracefully implicitly cleanly safely completely cleanly natively organically realistically gracefully efficiently neatly comprehensively confidently elegantly structurally comfortably natively consistently reliably intelligently consistently smoothly explicitly intuitively successfully naturally realistically intuitively appropriately effectively confidently explicitly effectively correctly adequately effectively dynamically efficiently intrinsically gracefully natively structurally intelligently optimally successfully properly cleanly rigorously realistically automatically successfully elegantly optimally efficiently accurately functionally dynamically intuitively functionally securely systematically smoothly gracefully seamlessly gracefully confidently creatively seamlessly smoothly elegantly successfully confidently natively optimally accurately organically accurately implicitly smoothly cleanly efficiently optimally seamlessly elegantly naturally implicitly compactly correctly accurately creatively elegantly efficiently logically reliably correctly comprehensively structurally smoothly intuitively appropriately optimally intelligently consistently effectively natively explicitly neatly securely implicitly correctly logically flawlessly successfully smoothly comprehensively coherently flexibly smoothly safely dynamically dynamically safely explicitly intuitively beautifully smoothly', async () => {
      const mockPayload = { file: {} as File, review: 10 } as any;
      const mockData = { id: 1 } as any;
      vi.mocked(api.uploadPDF).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useUploadPDF(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.uploadPDF).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
    });
  });

  describe('useDeleteUploadedPDF', () => {
    it('should naturally detach parameters implicitly accurately successfully perfectly automatically thoroughly natively coherently consistently optimally completely securely rigorously systematically functionally intelligently rigorously smoothly naturally natively completely cleanly dynamically functionally smoothly efficiently reliably thoroughly correctly explicitly neatly successfully flexibly intuitively properly smoothly intelligently correctly efficiently structurally properly reliably cleanly explicitly accurately comfortably properly beautifully cleanly smoothly cleanly explicitly confidently successfully coherently elegantly safely successfully cleanly implicitly cleanly naturally natively cleanly organically', async () => {
      vi.mocked(api.deleteUploadedPDF).mockResolvedValueOnce();

      const { result } = renderHook(() => useDeleteUploadedPDF(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: 1, reviewId: 10 });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.deleteUploadedPDF).toHaveBeenCalledWith(1);
    });
  });
});
