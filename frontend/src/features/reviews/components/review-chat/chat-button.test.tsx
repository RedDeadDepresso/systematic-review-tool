import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatButton } from './chat-button';

describe('Components - ChatButton', () => {
  it('should render the button', () => {
    render(<ChatButton onClick={vi.fn()} unreadCount={0} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should not show unread indicator when unreadCount is 0', () => {
    render(<ChatButton onClick={vi.fn()} unreadCount={0} />);
    expect(screen.queryByText(/\d+/)).not.toBeInTheDocument();
  });

  it('should show numeric badge for unread counts 1-9', () => {
    render(<ChatButton onClick={vi.fn()} unreadCount={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should show 9+ badge when unread count is 10 or more', () => {
    render(<ChatButton onClick={vi.fn()} unreadCount={10} />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('should call onClick when the button is clicked', async () => {
    const onClick = vi.fn();
    render(<ChatButton onClick={onClick} unreadCount={0} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should apply custom className', () => {
    render(
      <ChatButton
        onClick={vi.fn()}
        unreadCount={0}
        className="my-custom-class"
      />
    );
    expect(screen.getByRole('button')).toHaveClass('my-custom-class');
  });
});
