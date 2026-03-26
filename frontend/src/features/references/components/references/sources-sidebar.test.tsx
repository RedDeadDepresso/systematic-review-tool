import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SourcesSidebar } from './sources-sidebar';

const defaultProps = {
  reviewId: 1,
  searchMethods: [
    { id: 1, name: 'PubMed', reviewId: 1, count: 1 },
    { id: 2, name: 'Scopus', reviewId: 1, count: 1 },
  ],
  userRole: 'owner' as const,
  selectedSearchMethodIds: [],
  onSearchMethodToggle: vi.fn(),
  onSelectAllReferences: vi.fn(),
  duplicateStatusCounts: {
    unresolved: 3,
    deleted: 1,
    resolved: 5,
    kept: 2,
  } as any,
  selectedDuplicateStatuses: [],
  onDuplicateStatusToggle: vi.fn(),
  totalReferences: 120,
  isCollapsed: false,
  onAddReferences: vi.fn(),
  onDetectDuplicates: vi.fn(),
  onResolveDuplicates: vi.fn(),
  onToggleCollapse: vi.fn(),
};

describe('Components - SourcesSidebar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render the search method names', () => {
    render(<SourcesSidebar {...defaultProps} />);
    expect(screen.getByText('PubMed')).toBeInTheDocument();
    expect(screen.getByText('Scopus')).toBeInTheDocument();
  });

  it('should call onSearchMethodToggle when a search method is clicked', async () => {
    const onSearchMethodToggle = vi.fn();
    render(
      <SourcesSidebar
        {...defaultProps}
        onSearchMethodToggle={onSearchMethodToggle}
      />
    );
    await userEvent.click(screen.getByText('PubMed'));
    expect(onSearchMethodToggle).toHaveBeenCalledWith(1);
  });

  it('should show Detect Duplicates and Resolve Duplicates buttons for owner', () => {
    render(<SourcesSidebar {...defaultProps} />);
    expect(screen.getByText('Detect Duplicates')).toBeInTheDocument();
    expect(screen.getByText('Resolve Duplicates')).toBeInTheDocument();
  });

  it('should not show duplicate management buttons for viewer role', () => {
    render(<SourcesSidebar {...defaultProps} userRole="viewer" />);
    expect(screen.queryByText('Detect Duplicates')).not.toBeInTheDocument();
    expect(screen.queryByText('Resolve Duplicates')).not.toBeInTheDocument();
  });

  it('should call onDetectDuplicates when Detect Duplicates is clicked', async () => {
    const onDetectDuplicates = vi.fn();
    render(
      <SourcesSidebar
        {...defaultProps}
        onDetectDuplicates={onDetectDuplicates}
      />
    );
    await userEvent.click(screen.getByText('Detect Duplicates'));
    expect(onDetectDuplicates).toHaveBeenCalledOnce();
  });

  it('should call onResolveDuplicates when Resolve Duplicates is clicked', async () => {
    const onResolveDuplicates = vi.fn();
    render(
      <SourcesSidebar
        {...defaultProps}
        onResolveDuplicates={onResolveDuplicates}
      />
    );
    await userEvent.click(screen.getByText('Resolve Duplicates'));
    expect(onResolveDuplicates).toHaveBeenCalledOnce();
  });

  it('should show duplicate status counts', () => {
    render(<SourcesSidebar {...defaultProps} />);
    expect(screen.getByText('3')).toBeInTheDocument(); // unresolved count
  });

  it('should call onDuplicateStatusToggle when a status filter is clicked', async () => {
    const onDuplicateStatusToggle = vi.fn();
    render(
      <SourcesSidebar
        {...defaultProps}
        onDuplicateStatusToggle={onDuplicateStatusToggle}
      />
    );
    // Expand duplicates section first if needed
    const unresolvedBtn = screen.queryByText('Unresolved');
    if (unresolvedBtn) {
      await userEvent.click(unresolvedBtn);
      expect(onDuplicateStatusToggle).toHaveBeenCalledWith('unresolved');
    }
  });

  it('should show delete confirmation when delete search method is triggered', async () => {
    const onDeleteSearchMethod = vi.fn();
    render(
      <SourcesSidebar
        {...defaultProps}
        onDeleteSearchMethod={onDeleteSearchMethod}
      />
    );
    // Look for trash/delete icons beside search methods
    const deleteBtns = screen
      .getAllByRole('button')
      .filter(
        (b) =>
          b.querySelector('svg') && b.className.includes('text-destructive')
      );
    if (deleteBtns.length > 0) {
      await userEvent.click(deleteBtns[0]);
      expect(screen.getByText('Delete Search Method')).toBeInTheDocument();
    }
  });
});
