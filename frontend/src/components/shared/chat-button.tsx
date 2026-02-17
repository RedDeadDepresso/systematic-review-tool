import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatButtonProps {
  onClick: () => void;
  unreadCount: number;
  className?: string;
}

export function ChatButton({
  onClick,
  unreadCount,
  className,
}: ChatButtonProps) {
  const hasUnread = unreadCount > 0;
  console.log(unreadCount);

  return (
    <Button
      onClick={onClick}
      variant="outline"
      size="sm"
      className={cn('h-8 w-8 p-0 relative', className)}
    >
      <MessageCircle className="h-4 w-4" />

      {/* Pulsing indicator */}
      {hasUnread && (
        <>
          {/* Outer pulse ring */}
          <span className="absolute top-0 right-0 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>

          {unreadCount > 0 && unreadCount < 10 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 text-[10px] font-bold text-white bg-blue-500 rounded-full">
              {unreadCount}
            </span>
          )}
          {unreadCount >= 10 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 text-[9px] font-bold text-white bg-blue-500 rounded-full">
              9+
            </span>
          )}
        </>
      )}
    </Button>
  );
}
