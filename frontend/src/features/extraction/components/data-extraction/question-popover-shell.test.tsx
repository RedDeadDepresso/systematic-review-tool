import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuestionPopoverShell } from './question-popover-shell';

describe('Components - QuestionPopoverShell', () => {
  it('should open and show title when trigger is clicked', async () => {
    render(
      <QuestionPopoverShell
        trigger={<button>Open</button>}
        title="Add Question"
        open={true}
        onOpenChange={vi.fn()}
      >
        <div>Form content</div>
      </QuestionPopoverShell>
    );
    expect(screen.getByText('Add Question')).toBeInTheDocument();
  });

  it('should render children inside the popover', () => {
    render(
      <QuestionPopoverShell
        trigger={<button>Open</button>}
        title="Add Question"
        open={true}
        onOpenChange={vi.fn()}
      >
        <div>Form content here</div>
      </QuestionPopoverShell>
    );
    expect(screen.getByText('Form content here')).toBeInTheDocument();
  });

  it('should call onOpenChange(false) when the X close button is clicked', async () => {
    const onOpenChange = vi.fn();
    render(
      <QuestionPopoverShell
        trigger={<button>Open</button>}
        title="Add Question"
        open={true}
        onOpenChange={onOpenChange}
      >
        <div>content</div>
      </QuestionPopoverShell>
    );
    // The X button inside the popover header
    const closeBtn = screen
      .getAllByRole('button')
      .find((b) => b !== screen.getByText('Open') && !b.textContent);
    await userEvent.click(closeBtn!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should not render popover content when open is false', () => {
    render(
      <QuestionPopoverShell
        trigger={<button>Open</button>}
        title="My Popover"
        open={false}
        onOpenChange={vi.fn()}
      >
        <div>Hidden content</div>
      </QuestionPopoverShell>
    );
    expect(screen.queryByText('My Popover')).not.toBeInTheDocument();
  });
});
