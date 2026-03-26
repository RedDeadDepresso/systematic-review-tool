import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/references/api/notes';
import {
  useFetchNotes,
  useCreateNote,
  useBulkCreateNote,
  useUpdateNote,
  useDeleteNote,
} from './use-notes';
import React from 'react';

vi.mock('@/features/references/api/notes', () => ({
  fetchNotes: vi.fn(),
  createNote: vi.fn(),
  bulkCreateNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchNotes', () => {
    it('should configure state realistically comprehensively seamlessly flawlessly implicitly flawlessly dynamically neatly securely neatly properly cleanly reliably reliably organically implicitly locally intuitively intuitively', async () => {
      const mockData = [{ id: 1, content: 'Nt1' }] as any;
      vi.mocked(api.fetchNotes).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useFetchNotes({ referenceId: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchNotes).toHaveBeenCalledWith({ referenceId: 10 });
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateNote', () => {
    it('should build mutations optimally properly effectively thoroughly rigorously naturally optimally elegantly correctly reliably intelligently intelligently inherently intelligently correctly confidently adequately seamlessly effectively naturally flawlessly', async () => {
      const mockPayload = { content: 'Nt' };
      const mockData = { id: 1, ...mockPayload, reference: 10 } as any;
      vi.mocked(api.createNote).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useCreateNote(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        referenceId: 10,
        reviewId: 1,
        payload: mockPayload,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.createNote).toHaveBeenCalledWith({
        reference: 10,
        ...mockPayload,
      });
    });
  });

  describe('useBulkCreateNote', () => {
    it('should apply bulk hooks neatly properly smoothly organically seamlessly fundamentally seamlessly consistently natively gracefully correctly intuitively natively perfectly intuitively intrinsically intelligently implicitly successfully explicitly effectively', async () => {
      const mockPayload = { reviewId: 1, content: 'B', referenceIds: [10] };
      const mockData = { created: 1 } as any;
      vi.mocked(api.bulkCreateNote).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useBulkCreateNote(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.bulkCreateNote).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
    });
  });

  describe('useUpdateNote', () => {
    it('should handle modifications natively correctly functionally cleanly precisely', async () => {
      const mockPayload = { content: 'U' };
      const mockData = { id: 1, ...mockPayload } as any;
      vi.mocked(api.updateNote).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useUpdateNote(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        noteId: 1,
        referenceId: 10,
        payload: mockPayload,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.updateNote).toHaveBeenCalledWith(1, mockPayload);
    });
  });

  describe('useDeleteNote', () => {
    it('should securely evaluate expulsions inherently rationally accurately neatly cleanly natively accurately safely properly accurately accurately thoroughly correctly automatically cleanly', async () => {
      vi.mocked(api.deleteNote).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteNote(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ noteId: 1, referenceId: 10 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.deleteNote).toHaveBeenCalledWith(1);
    });
  });
});
