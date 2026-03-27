// Individual chat message card with avatar, timestamp, and system-message metadata.
import { cn } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { ChatMessage } from '@/features/reviews/types/review-chat';

// Generate consistent avatar colors based on user ID
function getAvatarColor(userId: number): string {
  const colors = [
    '#EF4444', // red
    '#F59E0B', // amber
    '#10B981', // emerald
    '#3B82F6', // blue
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#14B8A6', // teal
    '#F97316', // orange
  ];
  return colors[userId % colors.length];
}

interface MemberAvatarProps {
  userName: string;
  userId: number | null;
  avatarUrl: string | null;
  isSystem: boolean;
  size?: 'sm' | 'md';
}

export function MemberAvatar({
  userName,
  userId,
  avatarUrl,
  isSystem,
  size = 'md',
}: MemberAvatarProps) {
  const sizeClasses = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  if (isSystem) {
    return (
      <div
        className={cn(
          'rounded-lg flex items-center justify-center font-bold text-white bg-gray-700',
          sizeClasses
        )}
      >
        🤖
      </div>
    );
  }

  // If user has avatar, show it
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={userName}
        className={cn('rounded-full object-cover', sizeClasses)}
        onError={(e) => {
          // Fallback to initials if image fails to load
          e.currentTarget.style.display = 'none';
          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
    );
  }

  // Fallback to initials
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium text-white relative',
        sizeClasses
      )}
      style={{ backgroundColor: getAvatarColor(userId || 0) }}
    >
      {initials}
    </div>
  );
}

// Helper function to safely format relative time
function formatMessageTime(timestamp: string): string {
  try {
    const date = parseISO(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error('Error parsing date:', timestamp, error);
    return 'Unknown time';
  }
}

function formatLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: unknown) {
  if (typeof value === 'number') {
    // If looks like confidence score
    if (value >= 0 && value <= 1) {
      return `${Math.round(value * 100)}%`;
    }

    return Math.round(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

function ChatMetadataCard({
  metadata,
}: {
  metadata?: Record<string, unknown>;
}) {
  if (!metadata) return null;

  return (
    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
      {Object.entries(metadata).map(([key, value]) => {
        if (value === undefined || value === null) return null;
        if (key === 'refresh_review') return null; // Hide internal flags
        return (
          <p key={key}>
            • {formatLabel(key)}: {formatValue(value)}
          </p>
        );
      })}
    </div>
  );
}

export function ChatMessageCard({ message }: { message: ChatMessage }) {
  return (
    <div
      key={message.id}
      className={cn(
        'px-4 py-4 border-b border-border/50 hover:bg-muted/30',
        message.isSystemMessage && 'bg-muted/20'
      )}
    >
      <div className="flex items-start gap-3">
        <MemberAvatar
          userName={message.userName || 'Unknown'}
          userId={message.userId}
          avatarUrl={message.avatarUrl || null}
          isSystem={message.isSystemMessage}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">
              {message.userName || 'Unknown User'}
            </span>
            {message.isSystemMessage && (
              <Badge variant="secondary" className="text-xs">
                System
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatMessageTime(message.createdAt)}
            </span>
          </div>
          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
            {message.message || '(empty message)'}
          </p>

          {message.isSystemMessage && message.metadata && (
            <ChatMetadataCard metadata={message.metadata} />
          )}
        </div>
      </div>
    </div>
  );
}
