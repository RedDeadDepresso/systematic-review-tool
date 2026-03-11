import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type ChatMessage } from '@/features/reviews/types/review-chat';
import { useFetchReviewMembers } from '@/features/reviews/hooks/use-review-members';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  ChatMessageCard,
  MemberAvatar,
} from '@/features/reviews/components/review-chat/chat-message';
import { capitalize } from '@/lib/capitalize';

interface ChatDrawerProps {
  reviewId: number;
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  sendMessage: (message: string) => void;
  sendTyping: (isTyping: boolean) => void;
  messages: ChatMessage[];
  typingUsers: Set<number>;
}

export function ChatDrawer({
  reviewId,
  open,
  onClose,
  messages,
  isConnected,
  typingUsers,
  sendMessage,
  sendTyping,
}: ChatDrawerProps) {
  const [messageInput, setMessageInput] = useState('');
  const [enabledMembers, setEnabledMembers] = useState<boolean>(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const { data: members = [] } = useFetchReviewMembers(
    reviewId,
    enabledMembers
  );

  useEffect(() => {
    if (open && !enabledMembers) {
      setEnabledMembers(true);
    }
  }, [open]);

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages]);

  // Cleanup typing indicator on unmount
  useEffect(() => {
    return () => {
      if (isTypingRef.current) {
        sendTyping(false);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [sendTyping]);

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      sendMessage(messageInput);
      setMessageInput('');
      inputRef.current?.focus();

      // Stop typing indicator
      if (isTypingRef.current) {
        sendTyping(false);
        isTypingRef.current = false;
      }

      // Clear timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessageInput(value);

    if (!isConnected) return;

    // Send typing indicator
    if (value.trim() && !isTypingRef.current) {
      sendTyping(true);
      isTypingRef.current = true;
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    if (value.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          sendTyping(false);
          isTypingRef.current = false;
        }
      }, 2000);
    } else {
      // Empty input, stop typing immediately
      if (isTypingRef.current) {
        sendTyping(false);
        isTypingRef.current = false;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get names of typing users
  const typingUserNames = Array.from(typingUsers)
    .map((userId) => {
      const member = members.find((m) => m.user.id === userId);
      return member?.user.firstName || 'Someone'; // Use first name only
    })
    .filter(Boolean);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 sm:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full sm:sm:w-100 bg-background border-l border-border shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
            <h2 className="font-semibold text-foreground">Review Chat</h2>
          </div>

          <Popover open={membersOpen} onOpenChange={setMembersOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary font-medium"
              >
                {members.length} {members.length === 1 ? 'Member' : 'Members'}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-medium text-foreground">Chat Members</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setMembersOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="py-2 max-h-96 overflow-y-auto">
                {members.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-muted-foreground text-center">
                    No members
                  </div>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50"
                    >
                      <MemberAvatar
                        userName={`${member.user.firstName} ${member.user.lastName}`}
                        userId={member.user.id}
                        avatarUrl={member.user.avatar || null}
                        isSystem={false}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.user.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.user.email}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {capitalize(member.role)}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Connection status indicator */}
        {!isConnected && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Connecting to chat...
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((message) => {
              return <ChatMessageCard key={message.id} message={message} />;
            })
          )}

          {/* Typing Indicator */}
          {typingUserNames.length > 0 && (
            <div className="px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex gap-1">
                <span
                  className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
              <span className="italic">
                {typingUserNames.length === 1
                  ? `${typingUserNames[0]} is typing...`
                  : typingUserNames.length === 2
                    ? `${typingUserNames[0]} and ${typingUserNames[1]} are typing...`
                    : `${typingUserNames.length} people are typing...`}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={messageInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={2}
              disabled={!isConnected}
              className="w-full resize-none rounded-lg border border-border bg-card px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 bottom-2 h-8 w-8 p-0 text-muted-foreground hover:text-primary"
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || !isConnected}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
