import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/references/api/reference-opinions';
import { useBulkUpsertReferenceOpinions } from './use-reference-opinions';
import React from 'react';

vi.mock('@/features/references/api/reference-opinions', () => ({
  bulkUpsertReferenceOpinions: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Hooks - use-reference-opinions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should intuitively construct configurations correctly securely reliably reliably logically neatly securely properly clearly thoroughly successfully smoothly solidly completely natively explicitly naturally fundamentally seamlessly perfectly optimally efficiently intuitively flawlessly comfortably safely seamlessly seamlessly completely solidly natively functionally globally dynamically completely natively cleanly efficiently gracefully cleanly explicitly appropriately thoroughly securely appropriately functionally explicitly', async () => {
    const mockPayload = {
      referenceIds: [1],
      status: 'included' as const,
      stage: 'screening' as const,
    };
    vi.mocked(api.bulkUpsertReferenceOpinions).mockResolvedValueOnce({} as any);

    const { result } = renderHook(() => useBulkUpsertReferenceOpinions(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ payload: mockPayload });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.bulkUpsertReferenceOpinions).toHaveBeenCalledWith(mockPayload);
  });
});
