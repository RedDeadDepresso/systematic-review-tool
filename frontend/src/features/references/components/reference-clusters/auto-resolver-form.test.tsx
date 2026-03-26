import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoResolverForm } from './auto-resolver-form';

vi.mock('@/features/references/hooks/use-reference-clusters', () => ({
  useAutoResolveDuplicates: vi.fn(),
}));

vi.mock('@/features/reviews/hooks/use-search-methods', () => ({
  useFetchSearchMethods: vi.fn(),
}));

import { useAutoResolveDuplicates } from '@/features/references/hooks/use-reference-clusters';
import { useFetchSearchMethods } from '@/features/reviews/hooks/use-search-methods';

const mockUseAutoResolveDuplicates = vi.mocked(useAutoResolveDuplicates);
const mockUseFetchSearchMethods = vi.mocked(useFetchSearchMethods);

const noopMutation = { mutate: vi.fn(), isPending: false };

describe('Components - AutoResolverForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAutoResolveDuplicates.mockReturnValue(noopMutation as any);
    mockUseFetchSearchMethods.mockReturnValue({ data: [] } as any);
  });

  it('should show "Find & Auto-Resolve" banner when detectFirst is true', () => {
    render(
      <AutoResolverForm reviewId={1} detectFirst={true} onClose={vi.fn()} />
    );
    expect(screen.getByText(/Find & Auto-Resolve/)).toBeInTheDocument();
  });

  it('should show "Auto-Resolve existing clusters" banner when detectFirst is false', () => {
    render(
      <AutoResolverForm reviewId={1} detectFirst={false} onClose={vi.fn()} />
    );
    expect(
      screen.getByText(/Auto-Resolve existing clusters/)
    ).toBeInTheDocument();
  });

  it('should show detection sensitivity slider only when detectFirst is true', () => {
    render(
      <AutoResolverForm reviewId={1} detectFirst={true} onClose={vi.fn()} />
    );
    expect(screen.getByText('Detection sensitivity')).toBeInTheDocument();
  });

  it('should not show detection sensitivity slider when detectFirst is false', () => {
    render(
      <AutoResolverForm reviewId={1} detectFirst={false} onClose={vi.fn()} />
    );
    expect(screen.queryByText('Detection sensitivity')).not.toBeInTheDocument();
  });

  it('should show the "Always resolve DOI matches" toggle', () => {
    render(
      <AutoResolverForm reviewId={1} detectFirst={false} onClose={vi.fn()} />
    );
    expect(screen.getByText('Always resolve DOI matches')).toBeInTheDocument();
  });

  it('should call onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    render(
      <AutoResolverForm reviewId={1} detectFirst={false} onClose={onClose} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should call mutate with correct payload on Resolve click', async () => {
    const mutate = vi.fn();
    mockUseAutoResolveDuplicates.mockReturnValue({
      ...noopMutation,
      mutate,
    } as any);

    render(
      <AutoResolverForm reviewId={3} detectFirst={false} onClose={vi.fn()} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        confidenceThreshold: 0.9,
        detectFirst: false,
        doiClustersAlways: true,
        preferredSearchMethodId: null,
      }),
      expect.any(Object)
    );
  });

  it('should label action button "Find & Resolve" when detectFirst is true', () => {
    render(
      <AutoResolverForm reviewId={1} detectFirst={true} onClose={vi.fn()} />
    );
    expect(
      screen.getByRole('button', { name: /Find & Resolve/ })
    ).toBeInTheDocument();
  });

  it('should show a warning alert when confidence threshold is below 87%', async () => {
    render(
      <AutoResolverForm reviewId={1} detectFirst={false} onClose={vi.fn()} />
    );
    // fireEvent.change triggers the onChange handler directly — avoids Slider
    // intercepting keystrokes in jsdom
    const numberInputs = screen
      .getAllByRole('spinbutton')
      .filter((el) => (el as HTMLInputElement).max === '100');
    fireEvent.change(numberInputs[0], { target: { value: '80' } });
    expect(screen.getByText(/Below 87% may auto-resolve/)).toBeInTheDocument();
  });

  it('should show Removing... when mutation is pending', () => {
    mockUseAutoResolveDuplicates.mockReturnValue({
      ...noopMutation,
      isPending: true,
    } as any);
    render(
      <AutoResolverForm reviewId={1} detectFirst={false} onClose={vi.fn()} />
    );
    expect(screen.getByText('Resolving…')).toBeInTheDocument();
  });

  it('should render search methods in the preferred source select', () => {
    mockUseFetchSearchMethods.mockReturnValue({
      data: [
        { id: 1, name: 'PubMed' },
        { id: 2, name: 'Scopus' },
      ],
    } as any);
    render(
      <AutoResolverForm reviewId={1} detectFirst={false} onClose={vi.fn()} />
    );
    expect(screen.getByText('Preferred source to keep')).toBeInTheDocument();
  });
});
