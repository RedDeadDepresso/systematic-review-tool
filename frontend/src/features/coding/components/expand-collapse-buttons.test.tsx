import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExpandCollapseButtons } from './expand-collapse-buttons';

describe('Components - ExpandCollapseButtons', () => {
  it('should render expand and collapse buttons', () => {
    render(
      <ExpandCollapseButtons onExpandAll={vi.fn()} onCollapseAll={vi.fn()} />
    );
    expect(screen.getByTitle('Expand all')).toBeInTheDocument();
    expect(screen.getByTitle('Collapse all')).toBeInTheDocument();
  });

  it('should show Expand and Collapse labels when not compact', () => {
    render(
      <ExpandCollapseButtons onExpandAll={vi.fn()} onCollapseAll={vi.fn()} />
    );
    expect(screen.getByText('Expand')).toBeInTheDocument();
    expect(screen.getByText('Collapse')).toBeInTheDocument();
  });

  it('should hide labels when compact', () => {
    render(
      <ExpandCollapseButtons
        onExpandAll={vi.fn()}
        onCollapseAll={vi.fn()}
        compact
      />
    );
    expect(screen.queryByText('Expand')).not.toBeInTheDocument();
    expect(screen.queryByText('Collapse')).not.toBeInTheDocument();
  });

  it('should call onExpandAll when expand button is clicked', async () => {
    const onExpandAll = vi.fn();
    render(
      <ExpandCollapseButtons
        onExpandAll={onExpandAll}
        onCollapseAll={vi.fn()}
      />
    );
    await userEvent.click(screen.getByTitle('Expand all'));
    expect(onExpandAll).toHaveBeenCalledOnce();
  });

  it('should call onCollapseAll when collapse button is clicked', async () => {
    const onCollapseAll = vi.fn();
    render(
      <ExpandCollapseButtons
        onExpandAll={vi.fn()}
        onCollapseAll={onCollapseAll}
      />
    );
    await userEvent.click(screen.getByTitle('Collapse all'));
    expect(onCollapseAll).toHaveBeenCalledOnce();
  });
});
