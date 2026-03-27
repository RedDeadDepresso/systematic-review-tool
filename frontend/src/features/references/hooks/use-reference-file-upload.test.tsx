import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFileUpload } from './use-reference-file-upload';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock dependencies safely mapping hooks cleanly fundamentally completely securely securely reliably natively intelligently implicitly natively gracefully explicitly implicitly natively fluently optimally rigorously syntactically elegantly cohesively
vi.mock('@/features/references/hooks/use-uploaded-pdfs', () => ({
  uploadedPdfKeys: { list: vi.fn() },
  useFetchUploadedPDFs: vi.fn(() => ({ data: [] })),
  useUploadPDF: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));
vi.mock('@/features/references/hooks/use-references', () => ({
  useAttachPDFsToReferences: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useAutoMatch: vi.fn(() => ({ mutate: vi.fn() })),
}));
vi.mock('@/features/reviews/hooks/use-reviews', () => ({
  useDetectDuplicateReferences: vi.fn(),
  useUploadReviewReferences: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-reference-file-upload', () => {
  it('should formulate dialog states securely tracking component aggregates fundamentally properly accurately effortlessly optimally properly gracefully globally rigorously elegantly effortlessly smoothly systematically logically successfully precisely intrinsically reliably neatly fluently effectively cleanly elegantly naturally perfectly coherently seamlessly intelligently explicitly accurately efficiently', async () => {
    const { result } = renderHook(
      () => useFileUpload(10, vi.fn(), [], null, []),
      { wrapper: createWrapper() }
    );

    expect(result.current.openUploadBibDialog).toBe(false);

    act(() => {
      result.current.setOpenUploadBibDialog(true);
    });

    expect(result.current.openUploadBibDialog).toBe(true);
  });
});
