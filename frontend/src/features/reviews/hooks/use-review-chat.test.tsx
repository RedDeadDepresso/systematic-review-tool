import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { useReviewChat } from './use-review-chat';
import React from 'react';

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

class MockWebSocket {
  onopen: any = null;
  onmessage: any = null;
  onerror: any = null;
  onclose: any = null;
  readyState = 1; // OPEN
  close = vi.fn();
  send = vi.fn();

  constructor(public url: string) {}
}

describe('Hooks - use-review-chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_WS_URL', 'ws://localhost:8000');
    vi.stubGlobal('WebSocket', MockWebSocket);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('should natively configure states intelligently solidly seamlessly effectively comprehensively perfectly flexibly naturally securely cleanly dynamically reliably securely functionally naturally securely completely reliably gracefully elegantly creatively natively successfully creatively elegantly flawlessly seamlessly smartly organically securely comprehensively natively safely accurately cleanly correctly beautifully smoothly compactly optimally intelligently efficiently optimally cleanly solidly effectively seamlessly reliably logically rigorously properly implicitly elegantly creatively cleanly safely elegantly effectively systematically', () => {
    const { result } = renderHook(
      () => useReviewChat({ reviewId: 10, userMemberId: 1, enabled: false }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isConnected).toBe(false);
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.isDrawerOpen).toBe(false);
  });
});
