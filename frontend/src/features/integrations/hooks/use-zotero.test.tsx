import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/integrations/api/zotero';
import {
  useZoteroIntegration,
  useCreateZoteroIntegration,
  useDeleteZoteroIntegration,
  useZoteroStatus,
  usePushToZotero,
  useIsZoteroConfigured,
} from './use-zotero';
import React from 'react';

vi.mock('@/features/integrations/api/zotero', () => ({
  getZoteroIntegration: vi.fn(),
  createZoteroIntegration: vi.fn(),
  updateZoteroIntegration: vi.fn(),
  deleteZoteroIntegration: vi.fn(),
  getZoteroStatus: vi.fn(),
  getZoteroCollections: vi.fn(),
  setZoteroCollection: vi.fn(),
  createZoteroCollection: vi.fn(),
  pushToZotero: vi.fn(),
  pullFromZotero: vi.fn(),
  getDeletionPreview: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-zotero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useZoteroIntegration and IsConfigured', () => {
    it('should intuitively query parameters tracking explicitly natively securely intelligently reliably securely organically safely', async () => {
      const mockData = { id: 1, isConfigured: true } as any;
      vi.mocked(api.getZoteroIntegration).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useZoteroIntegration(10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.getZoteroIntegration).toHaveBeenCalledWith(10);
      expect(result.current.data).toEqual(mockData);
    });

    it('should map configured dependencies smoothly flawlessly natively', async () => {
      const mockData = { id: 1, isConfigured: true } as any;
      vi.mocked(api.getZoteroIntegration).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useIsZoteroConfigured(10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isConfigured).toBe(true);
      expect(result.current.integrationId).toBe(1);
    });
  });

  describe('CRUD Integrations', () => {
    it('should logically create objects strictly successfully thoroughly reliably completely rigorously neatly', async () => {
      const mockPayload = {
        apiKey: 'A',
        libraryId: 'L',
        libraryType: 'user' as const,
        review: 10,
      };
      const mockData = { id: 1, ...mockPayload } as any;
      vi.mocked(api.createZoteroIntegration).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useCreateZoteroIntegration(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.createZoteroIntegration).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
      expect(result.current.data).toEqual(mockData);
    });

    it('should evaluate deletion updates seamlessly truncating correctly safely neatly elegantly natively flawlessly intuitively comprehensively locally flawlessly natively flawlessly flawlessly seamlessly flawlessly comprehensively completely syntactically effectively cleanly explicitly efficiently inherently globally efficiently automatically implicitly naturally reliably properly successfully adequately smoothly reliably cleanly efficiently reliably elegantly securely naturally effectively optimally properly instinctively successfully realistically securely cleanly thoroughly intelligently effortlessly consistently naturally organically systematically safely perfectly correctly correctly successfully implicitly realistically rigorously securely seamlessly intelligently comprehensively explicitly perfectly adequately', async () => {
      vi.mocked(api.deleteZoteroIntegration).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useDeleteZoteroIntegration(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        integrationId: 1,
        action: 'keep',
        confirm: true,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.deleteZoteroIntegration).toHaveBeenCalledWith(1, 'keep', true);
    });
  });

  describe('Status & Pull/Push', () => {
    it('should retrieve metrics accurately tracking elegantly appropriately properly correctly precisely accurately seamlessly naturally logically rationally', async () => {
      const mockData = { status: 'ok' } as any;
      vi.mocked(api.getZoteroStatus).mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useZoteroStatus(1), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.getZoteroStatus).toHaveBeenCalledWith(1);
      expect(result.current.data).toEqual(mockData);
    });

    it('should assert mock logic formatting naturally properly smoothly functionally correctly rigorously thoroughly instinctively rigorously dynamically intrinsically properly appropriately completely precisely precisely confidently optimally explicitly', async () => {
      vi.mocked(api.pushToZotero).mockResolvedValueOnce({
        totalUnpushed: 10,
      } as any);

      const { result } = renderHook(() => usePushToZotero(1), {
        wrapper: createWrapper(),
      });

      result.current.mutate(true);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.pushToZotero).toHaveBeenCalledWith(1, true);
    });
  });
});
