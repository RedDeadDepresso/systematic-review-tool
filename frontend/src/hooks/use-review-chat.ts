import { useEffect, useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const VITE_WS_URL = import.meta.env.VITE_WS_URL;

// Helper functions for localStorage
const getUnreadCountKey = (reviewId: number) => `chat_unread_${reviewId}`;

const getStoredUnreadCount = (reviewId: number): number => {
  try {
    const stored = localStorage.getItem(getUnreadCountKey(reviewId));
    return stored ? parseInt(stored, 10) : 0;
  } catch (error) {
    console.error('Error reading unread count from localStorage:', error);
    return 0;
  }
};

const setStoredUnreadCount = (reviewId: number, count: number) => {
  try {
    localStorage.setItem(getUnreadCountKey(reviewId), count.toString());
  } catch (error) {
    console.error('Error saving unread count to localStorage:', error);
  }
};

const clearStoredUnreadCount = (reviewId: number) => {
  try {
    localStorage.removeItem(getUnreadCountKey(reviewId));
  } catch (error) {
    console.error('Error clearing unread count from localStorage:', error);
  }
};

// Store last seen message ID to avoid counting old messages as unread
const getLastSeenMessageKey = (reviewId: number) =>
  `chat_last_seen_${reviewId}`;

const getLastSeenMessageId = (reviewId: number): number | null => {
  try {
    const stored = localStorage.getItem(getLastSeenMessageKey(reviewId));
    return stored ? parseInt(stored, 10) : null;
  } catch (error) {
    console.error(
      'Error reading last seen message ID from localStorage:',
      error
    );
    return null;
  }
};

const setLastSeenMessageId = (reviewId: number, messageId: number) => {
  try {
    localStorage.setItem(getLastSeenMessageKey(reviewId), messageId.toString());
  } catch (error) {
    console.error('Error saving last seen message ID to localStorage:', error);
  }
};

export interface ChatMessage {
  id: number;
  memberId: number | null;
  userId: number | null;
  userName: string;
  avatarUrl: string | null;
  message: string;
  isSystemMessage: boolean;
  metadata?: any;
  createdAt: string;
}

export interface ChatMember {
  id: number;
  userId: number;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  avatarColor: string;
}

interface UseReviewChatOptions {
  reviewId: number | null;
  enabled?: boolean;
}

export function camelCaseMessage(data) {
  const newMessage: ChatMessage = {
    id: data.message_id,
    memberId: data.member_id,
    userId: data.user_id,
    userName: data.user_name,
    avatarUrl: data.avatar_url || null,
    message: data.message,
    isSystemMessage: data.is_system_message || false,
    metadata: data.metadata,
    createdAt: data.created_at,
  };
  return newMessage;
}

export function useReviewChat({
  reviewId,
  enabled = true,
}: UseReviewChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members] = useState<ChatMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());

  // Initialize unread count from localStorage
  const [unreadCount, setUnreadCount] = useState(() =>
    reviewId ? getStoredUnreadCount(reviewId) : 0
  );

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reviewIdRef = useRef(reviewId);
  const typingTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isDrawerOpenRef = useRef(isDrawerOpen);

  useEffect(() => {
    isDrawerOpenRef.current = isDrawerOpen;
  }, [isDrawerOpen]);

  const queryClient = useQueryClient();

  // Update reviewId ref when it changes
  useEffect(() => {
    reviewIdRef.current = reviewId;

    // Load unread count for new review
    if (reviewId) {
      setUnreadCount(getStoredUnreadCount(reviewId));
    }
  }, [reviewId]);

  // Sync unread count to localStorage whenever it changes
  useEffect(() => {
    if (reviewId) {
      setStoredUnreadCount(reviewId, unreadCount);
    }
  }, [unreadCount, reviewId]);

  // Mark as read when drawer opens
  useEffect(() => {
    if (isDrawerOpen && reviewId && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      setLastSeenMessageId(reviewId, latestMessage.id);
      setUnreadCount(0);
      clearStoredUnreadCount(reviewId);
    }
  }, [isDrawerOpen, reviewId, messages]);

  const connect = useCallback(() => {
    if (!reviewId || !enabled) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const token = localStorage.getItem('access_token');
    const wsUrl = `${VITE_WS_URL}/review/${reviewId}/?token=${token}`;

    console.log('Connecting to review chat:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Review chat connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Chat message received:', data);

        if (data.type === 'message_history') {
          const validMessages = (data.messages || [])
            .map((msg: any) => camelCaseMessage(msg))
            .filter((msg: ChatMessage) => {
              if (!msg.id || !msg.createdAt) {
                console.warn('Invalid message in history:', msg);
                return false;
              }
              return true;
            });

          setMessages(validMessages);

          // Calculate unread count based on last seen message
          if (!isDrawerOpen && validMessages.length > 0) {
            const lastSeenId = getLastSeenMessageId(reviewId);
            if (lastSeenId !== null) {
              // Count messages after last seen
              const newMessages = validMessages.filter(
                (msg: ChatMessage) =>
                  msg.id > lastSeenId && !msg.isSystemMessage
              );
              setUnreadCount(newMessages.length);
            }
          }
        } else if (data.type === 'chat_message') {
          if (!data.message_id || !data.created_at) {
            console.error('Invalid chat message received:', data);
            return;
          }

          const newMessage = camelCaseMessage(data);

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });

          // If drawer is open, update last seen message ID immediately
          if (isDrawerOpenRef.current) {
            setLastSeenMessageId(reviewId, data.message_id);
          }
          // Increment unread count if drawer is closed
          else {
            console.log(
              'Incrementing unread count, drawer open:',
              isDrawerOpenRef.current
            );
            setUnreadCount((prev) => {
              const newCount = prev + 1;
              console.log('New unread count:', newCount);
              return newCount;
            });
          }

          if (data.is_system_message && data.metadata?.action) {
            if (data.metadata.action === 'deduplication_completed') {
              queryClient.invalidateQueries({
                queryKey: ['duplicate-references'],
              });
              queryClient.invalidateQueries({ queryKey: ['references'] });
            }
          }
        } else if (data.type === 'user_typing') {
          const userId = data.user_id;
          const isTyping = data.is_typing;

          setTypingUsers((prev) => {
            const next = new Set(prev);

            if (isTyping) {
              next.add(userId);

              const existingTimeout = typingTimeoutsRef.current.get(userId);
              if (existingTimeout) {
                clearTimeout(existingTimeout);
              }

              const timeout = setTimeout(() => {
                setTypingUsers((current) => {
                  const updated = new Set(current);
                  updated.delete(userId);
                  return updated;
                });
                typingTimeoutsRef.current.delete(userId);
              }, 3000);

              typingTimeoutsRef.current.set(userId, timeout);
            } else {
              next.delete(userId);

              const existingTimeout = typingTimeoutsRef.current.get(userId);
              if (existingTimeout) {
                clearTimeout(existingTimeout);
                typingTimeoutsRef.current.delete(userId);
              }
            }

            return next;
          });
        }
      } catch (error) {
        console.error('Error parsing chat message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsConnected(false);

      const shouldReconnect =
        event.code !== 1000 &&
        enabled &&
        reconnectAttemptsRef.current < 5 &&
        reviewIdRef.current === reviewId;

      if (shouldReconnect) {
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current - 1),
          10000
        );
        console.log(
          `Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/5)`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };
  }, [reviewId, enabled, isDrawerOpen, queryClient]);

  useEffect(() => {
    if (reviewId && enabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [reviewId, enabled, connect]);

  useEffect(() => {
    return () => {
      // Close websocket
      if (wsRef.current) {
        console.log('Closing WebSocket (cleanup)');
        wsRef.current.close(1000, 'Cleanup');
        wsRef.current = null;
      }

      // Clear typing timeouts
      typingTimeoutsRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      typingTimeoutsRef.current.clear();
    };
  }, [reviewId]);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat_message',
          message,
        })
      );
    } else {
      console.error('WebSocket not connected');
    }
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'typing',
          is_typing: isTyping,
        })
      );
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    typingTimeoutsRef.current.clear();
  }, []);

  return {
    messages,
    members,
    isConnected,
    typingUsers,
    unreadCount,
    sendMessage,
    sendTyping,
    isDrawerOpen,
    setIsDrawerOpen,
    disconnect,
  };
}
