import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScreeningBreakButton } from './screening-break-button';

vi.mock('@/features/reviews/hooks/use-screening-stats', () => ({
  useScreeningStats: vi.fn(),
}));

import { useScreeningStats } from '@/features/reviews/hooks/use-screening-stats';

const mockUseScreeningStats = vi.mocked(useScreeningStats);

describe('Components - ScreeningBreakButton', () => {
  it('should show Take Break button when not on break', () => {
    mockUseScreeningStats.mockReturnValue({
      isOnBreak: false,
      startBreak: vi.fn(),
      endBreak: vi.fn(),
    } as any);

    render(<ScreeningBreakButton reviewId={1} />);
    expect(screen.getByText('Take Break')).toBeInTheDocument();
  });

  it('should show Resume Work button when on break', () => {
    mockUseScreeningStats.mockReturnValue({
      isOnBreak: true,
      startBreak: vi.fn(),
      endBreak: vi.fn(),
    } as any);

    render(<ScreeningBreakButton reviewId={1} />);
    expect(screen.getByText('Resume Work')).toBeInTheDocument();
  });

  it('should call startBreak when clicking Take Break', async () => {
    const startBreak = vi.fn();
    mockUseScreeningStats.mockReturnValue({
      isOnBreak: false,
      startBreak,
      endBreak: vi.fn(),
    } as any);

    render(<ScreeningBreakButton reviewId={1} />);
    await userEvent.click(screen.getByRole('button'));
    expect(startBreak).toHaveBeenCalledOnce();
  });

  it('should call endBreak when clicking Resume Work', async () => {
    const endBreak = vi.fn();
    mockUseScreeningStats.mockReturnValue({
      isOnBreak: true,
      startBreak: vi.fn(),
      endBreak,
    } as any);

    render(<ScreeningBreakButton reviewId={1} />);
    await userEvent.click(screen.getByRole('button'));
    expect(endBreak).toHaveBeenCalledOnce();
  });

  it('should pass reviewId with autoTrack:false to the hook', () => {
    mockUseScreeningStats.mockReturnValue({
      isOnBreak: false,
      startBreak: vi.fn(),
      endBreak: vi.fn(),
    } as any);

    render(<ScreeningBreakButton reviewId={99} />);
    expect(mockUseScreeningStats).toHaveBeenCalledWith({
      reviewId: 99,
      autoTrack: false,
    });
  });
});
