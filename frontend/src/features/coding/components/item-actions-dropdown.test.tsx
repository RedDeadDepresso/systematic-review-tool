import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ItemActionsDropdown } from './item-actions-dropdown';

const defaultProps = {
  type: 'code' as const,
  name: 'Code A',
  description: 'A description',
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

describe('Components - ItemActionsDropdown', () => {
  it('should render the trigger button', () => {
    render(<ItemActionsDropdown {...defaultProps} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should open menu with Edit and Delete options', async () => {
    render(<ItemActionsDropdown {...defaultProps} />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should not show Jump option when onJump is not provided', async () => {
    render(<ItemActionsDropdown {...defaultProps} />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Jump')).not.toBeInTheDocument();
  });

  it('should show Jump option when onJump is provided', async () => {
    render(<ItemActionsDropdown {...defaultProps} onJump={vi.fn()} />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Jump')).toBeInTheDocument();
  });

  it('should call onJump when Jump item is clicked', async () => {
    const onJump = vi.fn();
    render(<ItemActionsDropdown {...defaultProps} onJump={onJump} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('Jump'));
    expect(onJump).toHaveBeenCalledOnce();
  });

  it('should call onDelete when Delete item is clicked', async () => {
    const onDelete = vi.fn();
    render(<ItemActionsDropdown {...defaultProps} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
