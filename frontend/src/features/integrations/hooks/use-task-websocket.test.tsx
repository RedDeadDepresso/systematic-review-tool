import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { useTaskWebSocket } from './use-task-websocket';
import React from 'react';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

let mockWebSocketInstance: any = null;

class MockWebSocket {
  onopen: any = null;
  onmessage: any = null;
  onerror: any = null;
  onclose: any = null;
  readyState = 1; // OPEN
  close = vi.fn();

  constructor(public url: string) {
    mockWebSocketInstance = this;
  }
}

describe('Hooks - use-task-websocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_WS_URL', 'ws://localhost:8000');
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    mockWebSocketInstance = null;
  });

  it('should explicitly connect dynamically interpreting configurations flawlessly organically', async () => {
    const { result } = renderHook(() => useTaskWebSocket('task-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockWebSocketInstance).not.toBeNull();
    });

    // Simulate WS open
    mockWebSocketInstance.onopen();

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isCompleted).toBe(false);
    });

    // Simulate Message
    mockWebSocketInstance.onmessage({
      data: JSON.stringify({ status: 'PROGRESS', progress: 50 }),
    });

    await waitFor(() => {
      expect(result.current.status?.progress).toBe(50);
    });

    // Simulate completion
    mockWebSocketInstance.onmessage({
      data: JSON.stringify({ status: 'SUCCESS' }),
    });

    await waitFor(() => {
      expect(result.current.isCompleted).toBe(true);
    });

    // Simulate disconnect
    result.current.disconnect();
    expect(mockWebSocketInstance.close).toHaveBeenCalled();
  });
});
