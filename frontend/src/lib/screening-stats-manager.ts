const VITE_WS_URL = import.meta.env.VITE_WS_URL;

/**
 * Global WebSocket manager for screening stats that tracks time continuously
 */
class ScreeningStatsManager {
  private ws: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentReviewId: number | null = null;
  private isOnBreak: boolean = false;
  private listeners: Set<(state: ScreeningStatsState) => void> = new Set();

  private get state(): ScreeningStatsState {
    return {
      isConnected: this.ws?.readyState === WebSocket.OPEN,
      isTracking: !this.isOnBreak && this.ws?.readyState === WebSocket.OPEN,
      isOnBreak: this.isOnBreak,
      reviewId: this.currentReviewId,
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  subscribe(listener: (state: ScreeningStatsState) => void) {
    this.listeners.add(listener);
    listener(this.state); // Send initial state
    return () => this.listeners.delete(listener);
  }

  connect(reviewId: number) {
    // If already connected to same review, do nothing
    if (
      this.currentReviewId === reviewId &&
      this.ws?.readyState === WebSocket.OPEN
    ) {
      console.log('Already connected to review', reviewId);
      return;
    }

    // Disconnect from previous review if different
    if (this.currentReviewId && this.currentReviewId !== reviewId) {
      this.disconnect();
    }

    this.currentReviewId = reviewId;
    const token = localStorage.getItem('access_token');
    console.log(VITE_WS_URL);
    const wsUrl = `${VITE_WS_URL}/screening-stats/${reviewId}/?token=${token}`;

    console.log('Connecting to screening stats:', reviewId);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Screening stats connected');
      this.notifyListeners();

      // Start heartbeat
      this.heartbeatInterval = setInterval(() => {
        this.sendMessage({ type: 'heartbeat' });
      }, 25000);

      // Start tracking if not on break
      if (!this.isOnBreak) {
        this.sendMessage({ type: 'start_tracking' });
      }
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'heartbeat_ack') {
        // Server acknowledged heartbeat
      } else if (data.type === 'break_started') {
        this.isOnBreak = true;
        this.notifyListeners();
      } else if (data.type === 'break_ended') {
        this.isOnBreak = false;
        this.notifyListeners();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.notifyListeners();
    };

    this.ws.onclose = (event) => {
      console.log('Screening stats closed:', event.code);
      this.cleanup();
      this.notifyListeners();
    };
  }

  disconnect() {
    console.log('Disconnecting screening stats');

    // Stop tracking before disconnect
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendMessage({ type: 'stop_tracking' });
    }

    this.cleanup();

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
    }

    this.ws = null;
    this.currentReviewId = null;
    this.notifyListeners();
  }

  startBreak() {
    if (this.isOnBreak) return;

    console.log('Starting break');
    this.isOnBreak = true;
    this.sendMessage({ type: 'break_start' });
    this.notifyListeners();
  }

  endBreak() {
    if (!this.isOnBreak) return;

    console.log('Ending break');
    this.isOnBreak = false;
    this.sendMessage({ type: 'break_end' });
    this.notifyListeners();
  }

  pauseTracking() {
    // Stop tracking (e.g., when navigating away from screening page)
    this.sendMessage({ type: 'stop_tracking' });
    this.notifyListeners();
  }

  resumeTracking() {
    // Resume tracking (e.g., when returning to screening page)
    if (!this.isOnBreak) {
      this.sendMessage({ type: 'start_tracking' });
      this.notifyListeners();
    }
  }

  private sendMessage(message: Record<string, any>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export interface ScreeningStatsState {
  isConnected: boolean;
  isTracking: boolean;
  isOnBreak: boolean;
  reviewId: number | null;
}

// Global singleton instance
export const screeningStatsManager = new ScreeningStatsManager();
