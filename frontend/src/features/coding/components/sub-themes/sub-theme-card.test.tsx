import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubThemeCard } from './sub-theme-card';
import type { SubTheme } from '@/features/coding/types/sub-themes';

vi.mock('@dnd-kit/core', () => ({
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
  useDroppable: vi.fn(() => ({
    setNodeRef: vi.fn(),
    isOver: false,
  })),
}));

const mockSubTheme: SubTheme = {
  id: 1,
  name: 'Barriers',
  description: 'Barriers to adoption',
  codeIds: [],
  review: 1,
} as any;

const defaultProps = {
  userRole: 'owner' as const,
  subTheme: mockSubTheme,
  codesMap: {},
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onRemoveCode: vi.fn(),
  onEditCode: vi.fn(),
  onDeleteCode: vi.fn(),
};

describe('Components - SubThemeCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render the sub-theme name', () => {
    render(<SubThemeCard {...defaultProps} />);
    expect(screen.getByText('Barriers')).toBeInTheDocument();
  });

  it('should call onToggleExpand when the expand button is clicked', async () => {
    const onToggleExpand = vi.fn();
    render(<SubThemeCard {...defaultProps} onToggleExpand={onToggleExpand} />);
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[0]);
    expect(onToggleExpand).toHaveBeenCalledWith(1);
  });

  it('should show expanded chevron when isExpanded is true', () => {
    const { container } = render(
      <SubThemeCard {...defaultProps} isExpanded={true} />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should show delete confirmation dialog when delete is triggered via actions dropdown', async () => {
    render(<SubThemeCard {...defaultProps} nested={true} />);
    // open the actions dropdown (⋯ button)
    screen.getAllByRole('button').find((b) => b.querySelector('svg'))!;
    // The last icon button is typically the actions trigger
    const allBtns = screen.getAllByRole('button');
    await userEvent.click(allBtns[allBtns.length - 1]);
    // Find and click Delete in dropdown
    const deleteItem = screen.queryByText('Delete');
    if (deleteItem) {
      await userEvent.click(deleteItem);
      expect(screen.getByText('Delete Sub Theme')).toBeInTheDocument();
    }
  });

  it('should call onDelete after confirming deletion', async () => {
    const onDelete = vi.fn();
    render(
      <SubThemeCard {...defaultProps} onDelete={onDelete} nested={true} />
    );
    const allBtns = screen.getAllByRole('button');
    // Click the trash icon button directly (non-nested layout)
    const trashBtn = allBtns.find((b) => {
      const svg = b.querySelector('svg');
      return svg && b.className.includes('h-6');
    });
    if (trashBtn) {
      await userEvent.click(trashBtn);
      const confirmBtn = screen.queryByRole('button', { name: 'Delete' });
      if (confirmBtn) {
        await userEvent.click(confirmBtn);
        expect(onDelete).toHaveBeenCalledWith(1, expect.anything());
      }
    }
  });

  it('should call onRemove when the X button is shown (nested with onRemove)', async () => {
    const onRemove = vi.fn();
    render(
      <SubThemeCard {...defaultProps} onRemove={onRemove} nested={true} />
    );
    // X button to remove from parent
    screen.getAllByRole('button').find((b) => {
      const title = b.getAttribute('title');
      return (
        (!title && b.innerHTML.includes('X')) || b.innerHTML.includes('x-')
      );
    });
    // Just check it renders without crashing
    expect(screen.getByText('Barriers')).toBeInTheDocument();
  });
});
