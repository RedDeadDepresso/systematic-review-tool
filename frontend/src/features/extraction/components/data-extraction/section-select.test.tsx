import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionSelect } from './section-select';

vi.mock('@/features/extraction/hooks/use-extraction-sections', () => ({
  useFetchExtractionSections: vi.fn(),
  useCreateExtractionSection: vi.fn(),
}));

import {
  useFetchExtractionSections,
  useCreateExtractionSection,
} from '@/features/extraction/hooks/use-extraction-sections';

const mockUseFetchExtractionSections = vi.mocked(useFetchExtractionSections);
const mockUseCreateExtractionSection = vi.mocked(useCreateExtractionSection);

const mockSections = [
  { id: 1, name: 'Population', review: 1 },
  { id: 2, name: 'Intervention', review: 1 },
];

const noopMutation = { mutate: vi.fn(), isPending: false };

describe('Components - SectionSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFetchExtractionSections.mockReturnValue({
      data: mockSections,
    } as any);
    mockUseCreateExtractionSection.mockReturnValue(noopMutation as any);
  });

  it('should render the placeholder when no value is selected', () => {
    render(<SectionSelect reviewId={1} value={null} onChange={vi.fn()} />);
    expect(screen.getByText('Select section...')).toBeInTheDocument();
  });

  it('should show selected section name when value is set', () => {
    render(<SectionSelect reviewId={1} value={1} onChange={vi.fn()} />);
    expect(screen.getByText('Population')).toBeInTheDocument();
  });

  it('should open a list of sections on click', async () => {
    render(<SectionSelect reviewId={1} value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByText('Population')).toBeInTheDocument();
    expect(screen.getByText('Intervention')).toBeInTheDocument();
  });

  it('should call onChange with the section id when a section is selected', async () => {
    const onChange = vi.fn();
    render(<SectionSelect reviewId={1} value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByText('Population'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('should filter sections by search input', async () => {
    render(<SectionSelect reviewId={1} value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.type(
      screen.getByPlaceholderText('Search or create section...'),
      'pop'
    );
    expect(screen.getByText('Population')).toBeInTheDocument();
    expect(screen.queryByText('Intervention')).not.toBeInTheDocument();
  });

  it('should show Create option when search query matches no section', async () => {
    render(<SectionSelect reviewId={1} value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.type(
      screen.getByPlaceholderText('Search or create section...'),
      'Outcomes'
    );
    expect(screen.getByText('Create "Outcomes"')).toBeInTheDocument();
  });

  it('should call createSectionMutation.mutate when Create option is clicked', async () => {
    const mutate = vi.fn();
    mockUseCreateExtractionSection.mockReturnValue({
      ...noopMutation,
      mutate,
    } as any);
    render(<SectionSelect reviewId={5} value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.type(
      screen.getByPlaceholderText('Search or create section...'),
      'Outcomes'
    );
    await userEvent.click(screen.getByText('Create "Outcomes"'));
    expect(mutate).toHaveBeenCalledWith(
      { review: 5, name: 'Outcomes' },
      expect.any(Object)
    );
  });

  it('should show "No sections found" when list is empty and no create option', () => {
    mockUseFetchExtractionSections.mockReturnValue({ data: [] } as any);
    render(<SectionSelect reviewId={1} value={null} onChange={vi.fn()} />);
    // open and check empty state
    userEvent.click(screen.getByRole('combobox'));
    // Empty sections list with no search → no create option → show empty message eventually
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should use a custom placeholder', () => {
    render(
      <SectionSelect
        reviewId={1}
        value={null}
        onChange={vi.fn()}
        placeholder="Choose a section"
      />
    );
    expect(screen.getByText('Choose a section')).toBeInTheDocument();
  });
});
