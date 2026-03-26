import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MatchPDFDialog } from './match-pdf-dialog';
import type { Reference } from '@/features/references/types/references';
import type { UploadedPDF } from '@/features/references/types/uploaded-pdfs';

const mockReferences: Partial<Reference>[] = [
  { id: 1, title: 'Study on Climate Change' },
  { id: 2, title: 'Urban Health Interventions' },
];

const mockPDFs: Partial<UploadedPDF>[] = [
  { id: 10, file: '/media/climate.pdf' },
  { id: 11, file: '/media/urban.pdf' },
];

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  references: mockReferences as Reference[],
  uploadedPDFs: mockPDFs as UploadedPDF[],
  onImport: vi.fn().mockResolvedValue(true),
  onAutoMatch: vi.fn().mockResolvedValue(true),
};

describe('Components - MatchPDFDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render both reference titles', () => {
    render(<MatchPDFDialog {...defaultProps} />);
    expect(screen.getByText('Study on Climate Change')).toBeInTheDocument();
    expect(screen.getByText('Urban Health Interventions')).toBeInTheDocument();
  });

  it('should render the Auto Match button', () => {
    render(<MatchPDFDialog {...defaultProps} />);
    expect(screen.getByText('Auto Match')).toBeInTheDocument();
  });

  it('should render the Import button disabled when no PDFs are selected', () => {
    render(<MatchPDFDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('should call onAutoMatch when Auto Match is clicked', async () => {
    const onAutoMatch = vi.fn().mockResolvedValue(true);
    render(<MatchPDFDialog {...defaultProps} onAutoMatch={onAutoMatch} />);
    await userEvent.click(screen.getByText('Auto Match'));
    expect(onAutoMatch).toHaveBeenCalledOnce();
  });

  it('should not render dialog content when closed', () => {
    render(<MatchPDFDialog {...defaultProps} open={false} />);
    expect(
      screen.queryByText('Study on Climate Change')
    ).not.toBeInTheDocument();
  });
});
