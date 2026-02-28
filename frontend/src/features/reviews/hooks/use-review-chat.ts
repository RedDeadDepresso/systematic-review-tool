import { useEffect, useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  ChatMember,
  ChatMessage,
} from '@/features/reviews/types/review-chat';
import { useLocalStorage } from 'usehooks-ts';

const VITE_WS_URL = import.meta.env.VITE_WS_URL;

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

interface UseReviewChatOptions {
  reviewId: number | null;
  userMemberId: number | null;
  enabled?: boolean;
}

export function camelCaseMessage(data: any) {
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
  userMemberId,
  enabled = true,
}: UseReviewChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members] = useState<ChatMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());

  // Initialize unread count from localStorage
  const storageKey = reviewId ? `chat_unread_${reviewId}` : undefined;

  const [unreadCount, setUnreadCount] = useLocalStorage<number>(
    storageKey ?? 'chat_unread_placeholder',
    0
  );

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reviewIdRef = useRef(reviewId);
  const typingTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isDrawerOpenRef = useRef(isDrawerOpen);
  const userMemberIdRef = useRef(userMemberId);

  useEffect(() => {
    isDrawerOpenRef.current = isDrawerOpen;
  }, [isDrawerOpen]);

  useEffect(() => {
    userMemberIdRef.current = userMemberId;
  }, [userMemberId]);

  const queryClient = useQueryClient();
  // Keep a mutable ref pointing to the latest `connect` implementation
  const connectRef = useRef<() => void>(() => {});

  // Mark as read when drawer opens
  useEffect(() => {
    if (isDrawerOpen && reviewId && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      setLastSeenMessageId(reviewId, latestMessage.id);
      setUnreadCount(0);
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
          const rawMessages = Array.isArray(data.messages) ? data.messages : [];
          const mappedMessages = rawMessages.map((msg: any) =>
            camelCaseMessage(msg)
          );
          const validMessages = mappedMessages.filter((msg: ChatMessage) => {
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
            if (
              newMessage.isSystemMessage &&
              userMemberIdRef.current != null &&
              newMessage.memberId === userMemberIdRef.current
            )
              toast.success(newMessage.message);
          }

          if (data.is_system_message && data.metadata?.refresh_review) {
            queryClient.invalidateQueries({ queryKey: ['reviews', reviewId] });
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
          // call via ref to avoid declaration-order issues during compilation
          connectRef.current();
        }, delay);
      }
    };
  }, [reviewId, enabled, isDrawerOpen, queryClient]);

  // Keep the connect ref up-to-date
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (reviewId && userMemberId && enabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [reviewId, userMemberId, enabled, connect]);

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
