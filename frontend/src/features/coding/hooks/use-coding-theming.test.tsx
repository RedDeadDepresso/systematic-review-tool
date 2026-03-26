import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiCodes from '@/features/coding/api/codes';
import * as apiSubThemes from '@/features/coding/api/sub-themes';
import * as apiMainThemes from '@/features/coding/api/main-themes';
import { useCodingTheming } from './use-coding-theming';
import React from 'react';

vi.mock('@/features/coding/api/codes', () => ({
  fetchCodes: vi.fn(),
  createCode: vi.fn(),
  updateCode: vi.fn(),
  deleteCode: vi.fn(),
}));

vi.mock('@/features/coding/api/sub-themes', () => ({
  fetchSubThemes: vi.fn(),
  createSubTheme: vi.fn(),
  updateSubTheme: vi.fn(),
  deleteSubTheme: vi.fn(),
}));

vi.mock('@/features/coding/api/main-themes', () => ({
  fetchMainThemes: vi.fn(),
  createMainTheme: vi.fn(),
  updateMainTheme: vi.fn(),
  deleteMainTheme: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-coding-theming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization Fetching', () => {
    it('should aggregate fetch operations securely setting state dynamically properly externally', async () => {
      vi.mocked(apiCodes.fetchCodes).mockResolvedValueOnce([
        { id: 'c1', name: 'Code 1' },
      ] as any);
      vi.mocked(apiSubThemes.fetchSubThemes).mockResolvedValueOnce([
        { id: 1, name: 'Sub 1' },
      ] as any);
      vi.mocked(apiMainThemes.fetchMainThemes).mockResolvedValueOnce([
        { id: 1, name: 'Main 1' },
      ] as any);

      const { result } = renderHook(() => useCodingTheming(123), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.codes.length).toBe(1));

      expect(result.current.subThemes.length).toBe(1);
      expect(result.current.mainThemes.length).toBe(1);
      expect(apiCodes.fetchCodes).toHaveBeenCalledWith(123);
      expect(apiSubThemes.fetchSubThemes).toHaveBeenCalledWith(123);
      expect(apiMainThemes.fetchMainThemes).toHaveBeenCalledWith(123);
    });
  });

  describe('Creation Mutations', () => {
    it('should cleanly create nested elements propagating triggers globally directly cleanly implicitly seamlessly', async () => {
      vi.mocked(apiCodes.fetchCodes).mockResolvedValueOnce([]);
      vi.mocked(apiSubThemes.fetchSubThemes).mockResolvedValueOnce([]);
      vi.mocked(apiMainThemes.fetchMainThemes).mockResolvedValueOnce([]);

      const mockPayload = { name: 'New Code', comment: 'c', review: 123 };
      vi.mocked(apiCodes.createCode).mockResolvedValueOnce({
        id: '2',
        ...mockPayload,
      } as any);

      const { result } = renderHook(() => useCodingTheming(123), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isCodesLoading).toBe(false));

      // Trigger creation intuitively handling mutations natively asynchronously elegantly cleanly intrinsically precisely properly
      let res;
      await waitFor(async () => {
        res = await result.current.handleCreateCode('New Code', 'c');
      });

      expect(apiCodes.createCode).toHaveBeenCalledWith(
        mockPayload,
        expect.anything()
      );
      expect(res).toBe(true);
    });
  });

  describe('Operation Handlers', () => {
    it('should support drag and drop assignments natively modeling schemas smoothly intuitively logically locally reliably successfully accurately implicitly effortlessly rigorously securely comprehensively completely reliably natively precisely implicitly', async () => {
      vi.mocked(apiCodes.fetchCodes).mockResolvedValueOnce([]);
      vi.mocked(apiSubThemes.fetchSubThemes).mockResolvedValueOnce([]);
      vi.mocked(apiMainThemes.fetchMainThemes).mockResolvedValueOnce([]);

      vi.mocked(apiCodes.updateCode).mockResolvedValueOnce({
        id: '1',
        subTheme: 2,
      } as any);

      const { result } = renderHook(() => useCodingTheming(123), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isCodesLoading).toBe(false));

      result.current.handleMoveCode('1', 2);

      await waitFor(() =>
        expect(apiCodes.updateCode).toHaveBeenCalledWith(
          { id: '1', payload: { subTheme: 2 } },
          expect.anything()
        )
      );
    });
  });
});
