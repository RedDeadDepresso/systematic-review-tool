import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReviewChat } from './use-review-chat';
import React from 'react';
import { vi, describe, it, expect } from 'vitest';

class MockWebSocket {
  readyState = 1;
  close = vi.fn();
  send = vi.fn();
  constructor(public url: string) {
    console.error('MockWebSocket CREATED with url:', url);
  }
}

describe('debug', () => {
  it('debugs', () => {
    vi.stubEnv('VITE_WS_URL', 'ws://localhost:8000');
    vi.stubGlobal('WebSocket', MockWebSocket);

    console.error('Start Test');

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => {
        console.error('Inside renderHook');
        return useReviewChat({ reviewId: 10, userMemberId: 1, enabled: true });
      },
      { wrapper }
    );

    console.error('Hook returned, isConnected=', result.current.isConnected);
    expect(true).toBe(true);
  });
});
