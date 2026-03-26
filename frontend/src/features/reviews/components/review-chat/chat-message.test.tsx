import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatMessageCard, MemberAvatar } from './chat-message';
import type { ChatMessage } from '@/features/reviews/types/review-chat';

const baseMessage: ChatMessage = {
  id: 1,
  memberId: 10,
  userId: 2,
  userName: 'Alice Smith',
  avatarUrl: null,
  message: 'Hello team!',
  isSystemMessage: false,
  createdAt: new Date().toISOString(),
};

describe('Components - MemberAvatar', () => {
  it('should render robot emoji for system messages', () => {
    render(
      <MemberAvatar
        userName="System"
        userId={null}
        avatarUrl={null}
        isSystem={true}
      />
    );
    expect(screen.getByText('🤖')).toBeInTheDocument();
  });

  it('should render initials when no avatarUrl and not system', () => {
    render(
      <MemberAvatar
        userName="Alice Smith"
        userId={1}
        avatarUrl={null}
        isSystem={false}
      />
    );
    expect(screen.getByText('AS')).toBeInTheDocument();
  });

  it('should render an img when avatarUrl is provided', () => {
    render(
      <MemberAvatar
        userName="Alice"
        userId={1}
        avatarUrl="https://example.com/avatar.jpg"
        isSystem={false}
      />
    );
    expect(screen.getByRole('img', { name: 'Alice' })).toBeInTheDocument();
  });
});

describe('Components - ChatMessageCard', () => {
  it('should render the user name', () => {
    render(<ChatMessageCard message={baseMessage} />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('should render the message text', () => {
    render(<ChatMessageCard message={baseMessage} />);
    expect(screen.getByText('Hello team!')).toBeInTheDocument();
  });

  it('should show System badge for system messages', () => {
    render(
      <ChatMessageCard message={{ ...baseMessage, isSystemMessage: true }} />
    );
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('should not show System badge for regular messages', () => {
    render(<ChatMessageCard message={baseMessage} />);
    expect(screen.queryByText('System')).not.toBeInTheDocument();
  });

  it('should render (empty message) when message is empty string', () => {
    render(<ChatMessageCard message={{ ...baseMessage, message: '' }} />);
    expect(screen.getByText('(empty message)')).toBeInTheDocument();
  });

  it('should fall back to Unknown User when userName is missing', () => {
    render(<ChatMessageCard message={{ ...baseMessage, userName: '' }} />);
    expect(screen.getAllByText('Unknown User').length).toBeGreaterThan(0);
  });
});
