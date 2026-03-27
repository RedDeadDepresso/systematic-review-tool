import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screeningStatsManager } from './screening-stats-manager';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(public url: string) {
    // We delay the OPEN state slightly or simulate it manually
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.();
    }, 0);
  }
}

describe('screeningStatsManager', () => {
  let originalWebSocket: any;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    screeningStatsManager.disconnect();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('can connect and update state', async () => {
    let state: any = null;
    const unsubscribe = screeningStatsManager.subscribe((s) => {
      state = s;
    });

    expect(state).toEqual({
      isConnected: false,
      isTracking: false,
      isOnBreak: false,
      reviewId: null,
    });

    screeningStatsManager.connect(1);

    // Initial state after calling connect (still connecting)
    expect(state?.isConnected).toBe(false);

    // Wait for connection to establish
    await vi.runOnlyPendingTimersAsync();

    expect(state).toEqual({
      isConnected: true,
      isTracking: true, // starts tracking immediately if not on break
      isOnBreak: false,
      reviewId: 1,
    });

    unsubscribe();
  });

  it('handles starting and ending breaks', async () => {
    let state: any = null;
    screeningStatsManager.subscribe((s) => {
      state = s;
    });

    screeningStatsManager.connect(1);
    await vi.runOnlyPendingTimersAsync();

    screeningStatsManager.startBreak();
    expect(state?.isOnBreak).toBe(true);
    expect(state?.isTracking).toBe(false);

    screeningStatsManager.endBreak();
    expect(state?.isOnBreak).toBe(false);
    expect(state?.isTracking).toBe(true);
  });
});
