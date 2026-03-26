import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ExportDropdown,
  copyLatexToClipboard,
  copyJsonToClipboard,
} from './export-dropdown';

vi.mock('@/features/reviews/api/reviews', () => ({
  getLatexExport: vi.fn(),
  getJsonExport: vi.fn(),
  downloadLatexFile: vi.fn(),
  downloadJsonFile: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import * as reviewsApi from '@/features/reviews/api/reviews';
import { toast } from 'sonner';

describe('Components - ExportDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the Export button', () => {
    render(<ExportDropdown reviewId={1} />);
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('should show export menu items when opened', async () => {
    render(<ExportDropdown reviewId={1} />);
    await userEvent.click(screen.getByText('Export'));
    expect(screen.getByText('Copy JSON')).toBeInTheDocument();
    expect(screen.getByText('Download JSON')).toBeInTheDocument();
    expect(screen.getByText('Copy LaTeX')).toBeInTheDocument();
    expect(screen.getByText('Download LaTeX')).toBeInTheDocument();
  });

  it('should call downloadJsonFile when Download JSON is clicked', async () => {
    render(<ExportDropdown reviewId={42} />);
    await userEvent.click(screen.getByText('Export'));
    await userEvent.click(screen.getByText('Download JSON'));
    expect(reviewsApi.downloadJsonFile).toHaveBeenCalledWith(42);
  });

  it('should call downloadLatexFile when Download LaTeX is clicked', async () => {
    render(<ExportDropdown reviewId={42} />);
    await userEvent.click(screen.getByText('Export'));
    await userEvent.click(screen.getByText('Download LaTeX'));
    expect(reviewsApi.downloadLatexFile).toHaveBeenCalledWith(42);
  });
});

describe('copyLatexToClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('should return true and write to clipboard on success', async () => {
    vi.mocked(reviewsApi.getLatexExport).mockResolvedValueOnce({
      latexCode: '\\table{}',
    } as any);
    const result = await copyLatexToClipboard(1);
    expect(result).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('\\table{}');
  });

  it('should return false and show error on failure', async () => {
    vi.mocked(reviewsApi.getLatexExport).mockRejectedValueOnce(
      new Error('Network error')
    );
    const result = await copyLatexToClipboard(1);
    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('copyJsonToClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('should return true and write formatted JSON to clipboard', async () => {
    const mockData = { items: [1, 2, 3] };
    vi.mocked(reviewsApi.getJsonExport).mockResolvedValueOnce(mockData as any);
    const result = await copyJsonToClipboard(1, true);
    expect(result).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      JSON.stringify(mockData, null, 2)
    );
  });

  it('should return false and show error toast on failure', async () => {
    vi.mocked(reviewsApi.getJsonExport).mockRejectedValueOnce(
      new Error('fail')
    );
    const result = await copyJsonToClipboard(1);
    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });
});
