import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteIntegrationDialog } from './delete-integration-dialog';

vi.mock('@/features/integrations/hooks/use-zotero', () => ({
  useDeleteZoteroIntegration: vi.fn(),
  useDeletionPreview: vi.fn(),
}));

import {
  useDeleteZoteroIntegration,
  useDeletionPreview,
} from '@/features/integrations/hooks/use-zotero';

const mockUseDeleteZoteroIntegration = vi.mocked(useDeleteZoteroIntegration);
const mockUseDeletionPreview = vi.mocked(useDeletionPreview);

const noopMutation = { mutate: vi.fn(), isPending: false };

describe('Components - DeleteIntegrationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDeleteZoteroIntegration.mockReturnValue(noopMutation as any);
    mockUseDeletionPreview.mockReturnValue({ data: null } as any);
  });

  it('should render the Remove Integration trigger button', () => {
    render(<DeleteIntegrationDialog integrationId={1} />);
    expect(screen.getByText('Remove Integration')).toBeInTheDocument();
  });

  it('should open dialog with title when trigger is clicked', async () => {
    render(<DeleteIntegrationDialog integrationId={1} />);
    await userEvent.click(screen.getByText('Remove Integration'));
    expect(screen.getByText('Remove Zotero Integration')).toBeInTheDocument();
  });

  it('should show all three action radio options', async () => {
    render(<DeleteIntegrationDialog integrationId={1} />);
    await userEvent.click(screen.getByText('Remove Integration'));
    expect(screen.getByLabelText(/Keep Everything/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Unlink but Keep PDFs/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reset Everything/)).toBeInTheDocument();
  });

  it('should default to "unlink" action', async () => {
    render(<DeleteIntegrationDialog integrationId={1} />);
    await userEvent.click(screen.getByText('Remove Integration'));
    expect(screen.getByLabelText(/Unlink but Keep PDFs/)).toBeChecked();
  });

  it('should show destructive warning when reset option is selected', async () => {
    render(<DeleteIntegrationDialog integrationId={1} />);
    await userEvent.click(screen.getByText('Remove Integration'));
    await userEvent.click(screen.getByLabelText(/Reset Everything/));
    expect(
      screen.getByText(/This will permanently delete/)
    ).toBeInTheDocument();
  });

  it('should call mutate with correct action on confirm', async () => {
    const mutate = vi.fn();
    mockUseDeleteZoteroIntegration.mockReturnValue({
      ...noopMutation,
      mutate,
    } as any);

    render(<DeleteIntegrationDialog integrationId={42} />);
    await userEvent.click(screen.getByText('Remove Integration'));
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Integration' })
    );

    expect(mutate).toHaveBeenCalledWith(
      { integrationId: 42, action: 'unlink', confirm: true },
      expect.any(Object)
    );
  });

  it('should show preview stats when preview data is available', async () => {
    mockUseDeletionPreview.mockReturnValue({
      data: {
        synced_references: 12,
        references_with_pdfs: 5,
        collection: null,
      },
    } as any);

    render(<DeleteIntegrationDialog integrationId={1} />);
    await userEvent.click(screen.getByText('Remove Integration'));
    expect(
      screen.getByText(/12 references synced to Zotero/)
    ).toBeInTheDocument();
    expect(screen.getByText(/5 references have PDFs/)).toBeInTheDocument();
  });

  it('should show Removing... text when mutation is pending', async () => {
    mockUseDeleteZoteroIntegration.mockReturnValue({
      ...noopMutation,
      isPending: true,
    } as any);

    render(<DeleteIntegrationDialog integrationId={1} />);
    await userEvent.click(screen.getByText('Remove Integration'));
    expect(screen.getByText('Removing...')).toBeInTheDocument();
  });

  it('should close dialog when Cancel is clicked', async () => {
    render(<DeleteIntegrationDialog integrationId={1} />);
    await userEvent.click(screen.getByText('Remove Integration'));
    expect(screen.getByText('Remove Zotero Integration')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByText('Remove Zotero Integration')
    ).not.toBeInTheDocument();
  });
});
