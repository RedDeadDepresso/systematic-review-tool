import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedPDFDialog } from './saved-pdf-dialog';

vi.mock('@/features/references/hooks/use-uploaded-pdfs', () => ({
  useFetchUploadedPDFs: vi.fn(),
  useDeleteUploadedPDF: vi.fn(),
}));

import {
  useFetchUploadedPDFs,
  useDeleteUploadedPDF,
} from '@/features/references/hooks/use-uploaded-pdfs';

const mockUseFetchUploadedPDFs = vi.mocked(useFetchUploadedPDFs);
const mockUseDeleteUploadedPDF = vi.mocked(useDeleteUploadedPDF);

const noopMutation = { mutate: vi.fn(), isPending: false };

const mockFiles = [
  { id: 1, name: 'paper-one.pdf', file: '/media/paper-one.pdf' },
  { id: 2, name: 'paper-two.pdf', file: '/media/paper-two.pdf' },
];

describe('Components - SavedPDFDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDeleteUploadedPDF.mockReturnValue(noopMutation as any);
  });

  it('should render dialog title when open', () => {
    mockUseFetchUploadedPDFs.mockReturnValue({ data: [] } as any);
    render(<SavedPDFDialog reviewId={1} open={true} onOpenChange={vi.fn()} />);
    expect(
      screen.getByText(/View and manage uploaded PDF/)
    ).toBeInTheDocument();
  });

  it('should show "No files uploaded" when there are no files', () => {
    mockUseFetchUploadedPDFs.mockReturnValue({ data: [] } as any);
    render(<SavedPDFDialog reviewId={1} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('No files uploaded')).toBeInTheDocument();
  });

  it('should render each uploaded PDF by name', () => {
    mockUseFetchUploadedPDFs.mockReturnValue({ data: mockFiles } as any);
    render(<SavedPDFDialog reviewId={1} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('paper-one.pdf')).toBeInTheDocument();
    expect(screen.getByText('paper-two.pdf')).toBeInTheDocument();
  });

  it('should filter files by search input', async () => {
    mockUseFetchUploadedPDFs.mockReturnValue({ data: mockFiles } as any);
    render(<SavedPDFDialog reviewId={1} open={true} onOpenChange={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Search files...'), 'one');
    expect(screen.getByText('paper-one.pdf')).toBeInTheDocument();
    expect(screen.queryByText('paper-two.pdf')).not.toBeInTheDocument();
  });

  it('should call deleteUploadedPDF.mutate with file id and reviewId on delete', async () => {
    const mutate = vi.fn();
    mockUseDeleteUploadedPDF.mockReturnValue({
      ...noopMutation,
      mutate,
    } as any);
    mockUseFetchUploadedPDFs.mockReturnValue({ data: mockFiles } as any);

    render(<SavedPDFDialog reviewId={7} open={true} onOpenChange={vi.fn()} />);
    const deleteButtons = screen.getAllByRole('button');
    await userEvent.click(deleteButtons[0]);

    expect(mutate).toHaveBeenCalledWith({ id: 1, reviewId: 7 });
  });

  it('should not render content when closed', () => {
    mockUseFetchUploadedPDFs.mockReturnValue({ data: [] } as any);
    render(<SavedPDFDialog reviewId={1} open={false} onOpenChange={vi.fn()} />);
    expect(
      screen.queryByText(/View and manage uploaded PDF/)
    ).not.toBeInTheDocument();
  });
});
