import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const VITE_WS_URL = import.meta.env.VITE_WS_URL;

interface TaskStatus {
  taskId: string;
  status:
    | 'PENDING'
    | 'STARTED'
    | 'PROGRESS'
    | 'SUCCESS'
    | 'FAILURE'
    | 'RETRY'
    | 'ERROR';
  message: string;
  result?: any;
  error?: string;
  // Progress fields
  progress?: number;
  total?: number;
  batch_number?: number;
  total_batches?: number;
  // Interim results
  pushed?: number;
  failed?: number;
  created?: number;
  updated?: number;
  pdfs?: number;
}

interface UseTaskWebSocketOptions {
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: TaskStatus) => void;
  onProgress?: (status: TaskStatus) => void;
}

export function useTaskWebSocket(
  taskId: string | null,
  options?: UseTaskWebSocketOptions
) {
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const taskCompletedRef = useRef(false);
  const optionsRef = useRef(options); // Store options in ref to avoid recreating connect function

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!taskId) {
      return;
    }

    // Reset state for new task
    taskCompletedRef.current = false;
    setIsCompleted(false);
    reconnectAttemptsRef.current = 0;
    setStatus(null);

    const connect = () => {
      // Don't reconnect if task already completed
      if (taskCompletedRef.current) {
        console.log('Task already completed, not reconnecting');
        return;
      }

      // Determine WebSocket URL based on environment
      const wsUrl = `${VITE_WS_URL}/task-status/${taskId}/`;

      console.log('Connecting to WebSocket:', wsUrl);

      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected for task:', taskId);
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        let data: TaskStatus | null = null;
        try {
          data = JSON.parse(event.data) as TaskStatus;
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          return;
        }

        console.log('WebSocket message received:', data);

        setStatus(data);
        const currentOptions = optionsRef.current;
        if (
          currentOptions &&
          typeof currentOptions.onStatusChange === 'function'
        ) {
          currentOptions.onStatusChange(data);
        }

        // Handle progress updates
        if (data.status === 'PROGRESS') {
          if (
            currentOptions &&
            typeof currentOptions.onProgress === 'function'
          ) {
            currentOptions.onProgress(data);
          }
        }

        // Handle completion
        if (data.status === 'SUCCESS') {
          taskCompletedRef.current = true;
          setIsCompleted(true);
          if (
            currentOptions &&
            typeof currentOptions.onSuccess === 'function'
          ) {
            currentOptions.onSuccess(data.result);
          }

          // Invalidate queries
          queryClient.invalidateQueries({ queryKey: ['zotero-status'] });
          queryClient.invalidateQueries({ queryKey: ['zotero-integration'] });
          queryClient.invalidateQueries({ queryKey: ['references'] });
        } else if (data.status === 'FAILURE' || data.status === 'ERROR') {
          taskCompletedRef.current = true;
          setIsCompleted(true);
          if (currentOptions && typeof currentOptions.onError === 'function') {
            currentOptions.onError(data.error || 'Task failed');
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);

        // Only attempt to reconnect if:
        // 1. Not a normal closure (code 1000)
        // 2. Task hasn't completed yet
        // 3. Haven't exceeded reconnect attempts
        const shouldReconnect =
          event.code !== 1000 &&
          !taskCompletedRef.current &&
          reconnectAttemptsRef.current < 5;

        if (shouldReconnect) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptsRef.current - 1),
            10000
          );
          console.log(
            `Task not completed, attempting to reconnect in ${delay}ms ` +
              `(attempt ${reconnectAttemptsRef.current}/5)`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          if (taskCompletedRef.current) {
            console.log('Task completed, not reconnecting');
          } else if (event.code === 1000) {
            console.log('Normal closure, not reconnecting');
          } else {
            console.log('Max reconnect attempts reached');
          }
        }
      };
    };

    // Initial connection
    connect();

    // Cleanup on unmount or when taskId changes
    return () => {
      console.log('Cleaning up WebSocket connection');

      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close WebSocket
      if (wsRef.current) {
        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          wsRef.current.close(1000, 'Component unmounting');
        }
        wsRef.current = null;
      }
    };
  }, [taskId, queryClient]); // Only depend on taskId and queryClient, not options

  return {
    status,
    isConnected,
    isCompleted: isCompleted,
    disconnect: () => {
      taskCompletedRef.current = true;
      setIsCompleted(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Manual disconnect');
      }
    },
  };
}
