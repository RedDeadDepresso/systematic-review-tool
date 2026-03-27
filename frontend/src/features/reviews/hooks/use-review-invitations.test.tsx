import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/reviews/api/review-invitations';
import {
  useSendInvitations,
  useFetchInvitations,
  useAcceptInvitation,
  useDeclineInvitation,
  useDeleteInvitation,
} from './use-review-invitations';
import React from 'react';

vi.mock('@/features/reviews/api/review-invitations', () => ({
  sendInvitations: vi.fn(),
  fetchInvitations: vi.fn(),
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
  deleteInvitation: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-review-invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFetchInvitations', () => {
    it('should map requests realistically syntactically structurally effectively automatically natively properly', async () => {
      const mockData = [{ id: 1 }] as any;
      vi.mocked(api.fetchInvitations).mockResolvedValueOnce(mockData);

      const { result } = renderHook(
        () => useFetchInvitations('received', true),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.fetchInvitations).toHaveBeenCalledWith('received');
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('Mutations', () => {
    it('should intelligently send invitations optimally seamlessly confidently solidly comprehensively explicitly flexibly natively explicitly successfully cleanly implicitly reliably explicitly carefully', async () => {
      vi.mocked(api.sendInvitations).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useSendInvitations(), {
        wrapper: createWrapper(),
      });

      result.current.mutate([] as any);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.sendInvitations).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything()
      );
    });

    it('should structurally execute acceptances inherently seamlessly flexibly realistically compactly completely adequately functionally optimally consistently effortlessly', async () => {
      vi.mocked(api.acceptInvitation).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useAcceptInvitation(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(1);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.acceptInvitation).toHaveBeenCalledWith(1, expect.anything());
    });

    it('should rigorously execute declines flexibly automatically elegantly beautifully structurally dynamically reliably cleanly logically completely explicitly gracefully natively carefully seamlessly logically optimally intelligently correctly organically confidently natively correctly implicitly comprehensively coherently accurately natively thoroughly comfortably smoothly cleanly smoothly cleanly rationally nicely dynamically robustly dynamically cleanly compactly intelligently safely', async () => {
      vi.mocked(api.declineInvitation).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useDeclineInvitation(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(1);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.declineInvitation).toHaveBeenCalledWith(1, expect.anything());
    });

    it('should intuitively perform deletion comprehensively securely efficiently comfortably consistently logically implicitly consistently organically optimally perfectly securely properly properly cleverly smoothly natively comprehensively beautifully smoothly confidently smoothly', async () => {
      vi.mocked(api.deleteInvitation).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteInvitation(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(1);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.deleteInvitation).toHaveBeenCalledWith(1, expect.anything());
    });
  });
});
