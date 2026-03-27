import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddQuestionPopover } from './add-question-popover';
import { EditQuestionPopover } from './edit-question-popover';
import type { ExtractionQuestion } from '@/features/extraction/types/extraction';

// ── Shared mocks ──────────────────────────────────────────────────────────────

vi.mock('@/features/extraction/hooks/use-question-form', () => ({
  useQuestionForm: vi.fn(),
}));

vi.mock('@/features/extraction/hooks/use-extraction-questions', () => ({
  useCreateExtractionQuestion: vi.fn(),
  useUpdateExtractionQuestion: vi.fn(),
  useDeleteExtractionQuestion: vi.fn(),
}));

// QuestionPopoverShell and QuestionFormFields are real but light —
// mock their heavy dependency SectionSelect to avoid extra hook setup
vi.mock(
  '@/features/extraction/components/data-extraction/section-select',
  () => ({
    SectionSelect: ({ onChange }: any) => (
      <button onClick={() => onChange(1)}>SectionSelect</button>
    ),
  })
);

vi.mock('@/features/extraction/hooks/use-extraction-sections', () => ({
  useFetchExtractionSections: vi.fn(() => ({ data: [] })),
  useCreateExtractionSection: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

import { useQuestionForm } from '@/features/extraction/hooks/use-question-form';
import {
  useCreateExtractionQuestion,
  useUpdateExtractionQuestion,
  useDeleteExtractionQuestion,
} from '@/features/extraction/hooks/use-extraction-questions';

const mockUseQuestionForm = vi.mocked(useQuestionForm);
const mockUseCreateExtractionQuestion = vi.mocked(useCreateExtractionQuestion);
const mockUseUpdateExtractionQuestion = vi.mocked(useUpdateExtractionQuestion);
const mockUseDeleteExtractionQuestion = vi.mocked(useDeleteExtractionQuestion);

const validForm = {
  sectionId: 1,
  question: 'What is the sample size?',
  questionType: 'number',
  columnTitle: 'Sample Size',
  required: false,
  options: [''],
  needsOptions: false,
  isValid: true,
  validOptions: [],
  reset: vi.fn(),
  setSectionId: vi.fn(),
  setQuestion: vi.fn(),
  setColumnTitle: vi.fn(),
  setRequired: vi.fn(),
  handleTypeChange: vi.fn(),
  handleAddOption: vi.fn(),
  handleRemoveOption: vi.fn(),
  handleOptionChange: vi.fn(),
};

const noopMutation = { mutate: vi.fn(), isPending: false };

// ── AddQuestionPopover ─────────────────────────────────────────────────────────

describe('Components - AddQuestionPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuestionForm.mockReturnValue(validForm as any);
    mockUseCreateExtractionQuestion.mockReturnValue(noopMutation as any);
  });

  it('should open the popover and show "Add Question" title when trigger is clicked', async () => {
    render(
      <AddQuestionPopover trigger={<button>Open Add</button>} reviewId={1} />
    );
    await userEvent.click(screen.getByText('Open Add'));
    expect(screen.getByText('Add Question')).toBeInTheDocument();
  });

  it('should render the Add submit button inside the popover', async () => {
    render(
      <AddQuestionPopover trigger={<button>Open Add</button>} reviewId={1} />
    );
    await userEvent.click(screen.getByText('Open Add'));
    // getAllByRole returns [trigger-button, submit-button] - the submit is last
    const addButtons = screen.getAllByRole('button', { name: 'Add' });
    expect(addButtons[addButtons.length - 1]).toBeInTheDocument();
  });

  it('should call createQuestionMutation.mutate with form values on submit', async () => {
    const mutate = vi.fn();
    mockUseCreateExtractionQuestion.mockReturnValue({
      ...noopMutation,
      mutate,
    } as any);

    render(
      <AddQuestionPopover
        trigger={<button>Open Add</button>}
        reviewId={1}
        onQuestionAdded={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText('Open Add'));
    // The submit button is the primary button (not the popover trigger)
    const addButtons = screen.getAllByRole('button', { name: 'Add' });
    await userEvent.click(addButtons[addButtons.length - 1]);

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        section: 1,
        question: 'What is the sample size?',
        columnTitle: 'Sample Size',
        type: 'number',
        required: false,
      }),
      expect.any(Object)
    );
  });

  it('should show Saving... when mutation is pending', async () => {
    mockUseCreateExtractionQuestion.mockReturnValue({
      ...noopMutation,
      isPending: true,
    } as any);

    render(
      <AddQuestionPopover trigger={<button>Open Add</button>} reviewId={1} />
    );
    await userEvent.click(screen.getByText('Open Add'));
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });
});

// ── EditQuestionPopover ────────────────────────────────────────────────────────

const mockQuestion: ExtractionQuestion = {
  id: 10,
  section: 1,
  question: 'What is the sample size?',
  type: 'number',
  columnTitle: 'Sample Size',
  required: false,
  options: [],
  order: 0,
} as any;

describe('Components - EditQuestionPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuestionForm.mockReturnValue(validForm as any);
    mockUseUpdateExtractionQuestion.mockReturnValue(noopMutation as any);
    mockUseDeleteExtractionQuestion.mockReturnValue(noopMutation as any);
  });

  it('should open and show "Edit Question" title', async () => {
    render(
      <EditQuestionPopover
        question={mockQuestion}
        trigger={<button>Edit</button>}
        reviewId={1}
      />
    );
    await userEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Edit Question')).toBeInTheDocument();
  });

  it('should show Save Changes button', async () => {
    render(
      <EditQuestionPopover
        question={mockQuestion}
        trigger={<button>Edit</button>}
        reviewId={1}
      />
    );
    await userEvent.click(screen.getByText('Edit'));
    expect(
      screen.getByRole('button', { name: 'Save Changes' })
    ).toBeInTheDocument();
  });

  it('should show Delete Question link', async () => {
    render(
      <EditQuestionPopover
        question={mockQuestion}
        trigger={<button>Edit</button>}
        reviewId={1}
      />
    );
    await userEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Delete Question')).toBeInTheDocument();
  });

  it('should call updateQuestionMutation.mutate on Save Changes', async () => {
    const mutate = vi.fn();
    mockUseUpdateExtractionQuestion.mockReturnValue({
      ...noopMutation,
      mutate,
    } as any);

    render(
      <EditQuestionPopover
        question={mockQuestion}
        trigger={<button>Edit</button>}
        reviewId={1}
      />
    );
    await userEvent.click(screen.getByText('Edit'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: 10,
        payload: expect.objectContaining({
          question: 'What is the sample size?',
          columnTitle: 'Sample Size',
        }),
      }),
      expect.any(Object)
    );
  });

  it('should show delete confirmation dialog when Delete Question is clicked', async () => {
    render(
      <EditQuestionPopover
        question={mockQuestion}
        trigger={<button>Edit</button>}
        reviewId={1}
      />
    );
    await userEvent.click(screen.getByText('Edit'));
    await userEvent.click(screen.getByText('Delete Question'));
    expect(
      screen.getByText(/Are you sure you want to delete/)
    ).toBeInTheDocument();
  });

  it('should call deleteQuestionMutation.mutate on delete confirmation', async () => {
    const mutate = vi.fn();
    mockUseDeleteExtractionQuestion.mockReturnValue({
      ...noopMutation,
      mutate,
    } as any);

    render(
      <EditQuestionPopover
        question={mockQuestion}
        trigger={<button>Edit</button>}
        reviewId={1}
      />
    );
    await userEvent.click(screen.getByText('Edit'));
    await userEvent.click(screen.getByText('Delete Question'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mutate).toHaveBeenCalledWith(
      { questionId: 10, sectionId: 1 },
      expect.any(Object)
    );
  });
});
