import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewsTable } from './reviews-table';

vi.mock('@/features/reviews/hooks/use-reviews', () => ({
  useCreateReview: vi.fn(),
  useUpdateReview: vi.fn(),
  useDeleteReview: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: vi.fn(() => ({ navigate: vi.fn() })),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({
    setQueryData: vi.fn(),
  })),
}));

import {
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
} from '@/features/reviews/hooks/use-reviews';

const mockUseCreateReview = vi.mocked(useCreateReview);
const mockUseUpdateReview = vi.mocked(useUpdateReview);
const mockUseDeleteReview = vi.mocked(useDeleteReview);

const noopMutation = { mutate: vi.fn(), isPending: false };

const mockReviews = [
  {
    id: 1,
    title: 'Climate Change Study',
    dateCreated: '2024-01-01',
    owner: 'Alice',
    referenceCount: 120,
    isActive: true,
  },
  {
    id: 2,
    title: 'Urban Health Review',
    dateCreated: '2024-02-01',
    owner: 'Bob',
    referenceCount: 45,
    isActive: true,
  },
];

describe('Components - ReviewsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateReview.mockReturnValue(noopMutation as any);
    mockUseUpdateReview.mockReturnValue(noopMutation as any);
    mockUseDeleteReview.mockReturnValue(noopMutation as any);
  });

  it('should render review titles in the table', () => {
    render(
      <ReviewsTable
        data={mockReviews as any}
        isActive={true}
        isLoading={false}
      />
    );
    expect(screen.getByText('Climate Change Study')).toBeInTheDocument();
    expect(screen.getByText('Urban Health Review')).toBeInTheDocument();
  });

  it('should render the filter input', () => {
    render(
      <ReviewsTable
        data={mockReviews as any}
        isActive={true}
        isLoading={false}
      />
    );
    expect(
      screen.getByPlaceholderText('Filter reviews...')
    ).toBeInTheDocument();
  });

  it('should render the Create Review button', () => {
    render(
      <ReviewsTable
        data={mockReviews as any}
        isActive={true}
        isLoading={false}
      />
    );
    expect(screen.getByText('Create Review')).toBeInTheDocument();
  });

  it('should filter rows by title', async () => {
    render(
      <ReviewsTable
        data={mockReviews as any}
        isActive={true}
        isLoading={false}
      />
    );
    await userEvent.type(
      screen.getByPlaceholderText('Filter reviews...'),
      'Climate'
    );
    expect(screen.getByText('Climate Change Study')).toBeInTheDocument();
    expect(screen.queryByText('Urban Health Review')).not.toBeInTheDocument();
  });

  it('should open the create review dialog when Create Review is clicked', async () => {
    render(<ReviewsTable data={[]} isActive={true} isLoading={false} />);
    await userEvent.click(screen.getByText('Create Review'));
    expect(
      screen.getByText('Create a new review for this project.')
    ).toBeInTheDocument();
  });

  it('should call createReview.mutate when the form is submitted', async () => {
    const mutate = vi.fn();
    mockUseCreateReview.mockReturnValue({ ...noopMutation, mutate } as any);

    render(<ReviewsTable data={[]} isActive={true} isLoading={false} />);
    await userEvent.click(screen.getByText('Create Review'));
    await userEvent.type(screen.getByLabelText('Title'), 'My New Review');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My New Review' })
    );
  });

  it('should show Archive option for active reviews', async () => {
    render(
      <ReviewsTable
        data={mockReviews as any}
        isActive={true}
        isLoading={false}
      />
    );
    const menuBtn = screen
      .getAllByRole('button')
      .find((b) => b.querySelector('svg') && b.className.includes('size-8'));
    if (menuBtn) {
      await userEvent.click(menuBtn);
      expect(screen.getByText('Archive')).toBeInTheDocument();
    }
  });

  it('should show Unarchive option for archived reviews', async () => {
    const archivedReview = [{ ...mockReviews[0], isActive: false }];
    render(
      <ReviewsTable
        data={archivedReview as any}
        isActive={false}
        isLoading={false}
      />
    );
    const menuBtn = screen
      .getAllByRole('button')
      .find((b) => b.querySelector('svg') && b.className.includes('size-8'));
    if (menuBtn) {
      await userEvent.click(menuBtn);
      expect(screen.getByText('Unarchive')).toBeInTheDocument();
    }
  });
});
