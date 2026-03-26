import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SectionSearch } from './section-search';

describe('Components - SectionSearch', () => {
  it('should render the search input with default placeholder', () => {
    render(<SectionSearch value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('should render with a custom placeholder', () => {
    render(
      <SectionSearch value="" onChange={vi.fn()} placeholder="Find themes..." />
    );
    expect(screen.getByPlaceholderText('Find themes...')).toBeInTheDocument();
  });

  it('should display the current value', () => {
    render(<SectionSearch value="hello" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });

  it('should call onChange when the user types', async () => {
    const onChange = vi.fn();
    render(<SectionSearch value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('should not render expand/collapse buttons when handlers are missing', () => {
    render(<SectionSearch value="" onChange={vi.fn()} />);
    expect(screen.queryByTitle('Expand all')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Collapse all')).not.toBeInTheDocument();
  });

  it('should render expand/collapse buttons when both handlers are provided', () => {
    render(
      <SectionSearch
        value=""
        onChange={vi.fn()}
        onExpandAll={vi.fn()}
        onCollapseAll={vi.fn()}
      />
    );
    expect(screen.getByTitle('Expand all')).toBeInTheDocument();
    expect(screen.getByTitle('Collapse all')).toBeInTheDocument();
  });
});
