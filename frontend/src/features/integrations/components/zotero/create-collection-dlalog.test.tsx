import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateCollectionDialog } from './create-collection-dlalog';

vi.mock('@/features/integrations/hooks/use-zotero', () => ({
  useCreateZoteroCollection: vi.fn(),
}));

import { useCreateZoteroCollection } from '@/features/integrations/hooks/use-zotero';

const mockUseCreateZoteroCollection = vi.mocked(useCreateZoteroCollection);
const noopMutation = { mutate: vi.fn(), isPending: false };

describe('Components - CreateCollectionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateZoteroCollection.mockReturnValue(noopMutation as any);
  });

  it('should render the Create Collection trigger button', () => {
    render(<CreateCollectionDialog reviewId={1} />);
    expect(screen.getByText('Create Collection')).toBeInTheDocument();
  });

  it('should open dialog with title on trigger click', async () => {
    render(<CreateCollectionDialog reviewId={1} />);
    await userEvent.click(screen.getByText('Create Collection'));
    expect(screen.getByText('Create Zotero Collection')).toBeInTheDocument();
  });

  it('should disable Create Collection submit button when name is empty', async () => {
    render(<CreateCollectionDialog reviewId={1} />);
    await userEvent.click(screen.getByText('Create Collection'));
    expect(
      screen.getByRole('button', { name: 'Create Collection' })
    ).toBeDisabled();
  });

  it('should enable submit button when name is entered', async () => {
    render(<CreateCollectionDialog reviewId={1} />);
    await userEvent.click(screen.getByText('Create Collection'));
    await userEvent.type(screen.getByLabelText('Collection Name'), 'My Review');
    expect(
      screen.getByRole('button', { name: 'Create Collection' })
    ).toBeEnabled();
  });

  it('should call mutate with name and setAsDefault on submit', async () => {
    const mutate = vi.fn();
    mockUseCreateZoteroCollection.mockReturnValue({
      ...noopMutation,
      mutate,
    } as any);

    render(<CreateCollectionDialog reviewId={5} />);
    await userEvent.click(screen.getByText('Create Collection'));
    await userEvent.type(
      screen.getByLabelText('Collection Name'),
      'Systematic Review 2026'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create Collection' })
    );

    expect(mutate).toHaveBeenCalledWith(
      { name: 'Systematic Review 2026', setAsDefault: true },
      expect.any(Object)
    );
  });

  it('should show Creating... while pending', async () => {
    mockUseCreateZoteroCollection.mockReturnValue({
      ...noopMutation,
      isPending: true,
    } as any);

    render(<CreateCollectionDialog reviewId={1} />);
    await userEvent.click(screen.getByText('Create Collection'));
    expect(screen.getByText('Creating...')).toBeInTheDocument();
  });

  it('should have the "Use for this review" switch enabled by default', async () => {
    render(<CreateCollectionDialog reviewId={1} />);
    await userEvent.click(screen.getByText('Create Collection'));
    const toggle = screen.getByRole('switch', { name: /Use for this review/i });
    expect(toggle).toBeChecked();
  });

  it('should close dialog when Cancel is clicked', async () => {
    render(<CreateCollectionDialog reviewId={1} />);
    await userEvent.click(screen.getByText('Create Collection'));
    expect(screen.getByText('Create Zotero Collection')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByText('Create Zotero Collection')
    ).not.toBeInTheDocument();
  });
});
