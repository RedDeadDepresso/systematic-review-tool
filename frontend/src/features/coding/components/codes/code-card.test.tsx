import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeCard } from './code-card';
import type { Code } from '@/features/coding/types/codes';

vi.mock('@dnd-kit/core', () => ({
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
}));

const mockCode: Code = {
  id: 'c1',
  name: 'Qualitative',
  comment: 'A comment',
  content: null,
  position: null,
} as any;

const defaultProps = {
  userRole: 'owner' as const,
  code: mockCode,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

describe('Components - CodeCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render the code name', () => {
    render(<CodeCard {...defaultProps} />);
    expect(screen.getByText('Qualitative')).toBeInTheDocument();
  });

  it('should render the comment when expanded', () => {
    render(<CodeCard {...defaultProps} isExpanded={true} />);
    expect(screen.getByText('A comment')).toBeInTheDocument();
  });

  it('should not render the comment when collapsed', () => {
    render(<CodeCard {...defaultProps} isExpanded={false} />);
    expect(screen.queryByText('A comment')).not.toBeInTheDocument();
  });

  it('should call onToggleExpand when the expand/collapse button is clicked', async () => {
    const onToggleExpand = vi.fn();
    render(<CodeCard {...defaultProps} onToggleExpand={onToggleExpand} />);
    // The toggle button is the first icon button after the drag handle
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[0]);
    expect(onToggleExpand).toHaveBeenCalledWith('c1');
  });

  it('should show overlay ring styling when isOverlay is true', () => {
    const { container } = render(
      <CodeCard {...defaultProps} isOverlay={true} />
    );
    expect(container.firstChild).toBeDefined();
  });

  it('should show the delete confirmation dialog on delete button click', async () => {
    render(<CodeCard {...defaultProps} isExpanded={true} nested={false} />);
    // Find the trash/delete button for owners
    screen.getAllByRole('button').find((b) => b.querySelector('svg'));
    // Click the last button which is delete (trash icon)
    const allBtns = screen.getAllByRole('button');
    await userEvent.click(allBtns[allBtns.length - 1]);
    expect(screen.getByText('Delete Code')).toBeInTheDocument();
  });

  it('should call onDelete after confirming deletion', async () => {
    const onDelete = vi.fn();
    render(
      <CodeCard {...defaultProps} onDelete={onDelete} isExpanded={true} />
    );
    const allBtns = screen.getAllByRole('button');
    await userEvent.click(allBtns[allBtns.length - 1]);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('c1');
  });

  it('should render the content quoted text when available', () => {
    const codeWithContent: Code = {
      ...mockCode,
      content: { text: 'Quoted text from article' },
    } as any;
    render(
      <CodeCard {...defaultProps} code={codeWithContent} isExpanded={true} />
    );
    expect(screen.getByText('"Quoted text from article"')).toBeInTheDocument();
  });
});
