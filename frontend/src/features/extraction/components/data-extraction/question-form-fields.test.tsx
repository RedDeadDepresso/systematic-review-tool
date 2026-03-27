import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionFormFields } from './question-form-fields';

vi.mock(
  '@/features/extraction/components/data-extraction/section-select',
  () => ({
    SectionSelect: ({ onChange, value }: any) => (
      <button data-testid="section-select" onClick={() => onChange(1)}>
        {value ? `Section ${value}` : 'Select section...'}
      </button>
    ),
  })
);

const makeForm = (overrides = {}) => ({
  sectionId: 1,
  question: 'What is the sample size?',
  questionType: 'number' as const,
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
  ...overrides,
});

describe('Components - QuestionFormFields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render the question textarea with current value', () => {
    render(
      <QuestionFormFields
        reviewId={1}
        form={makeForm() as any}
        submitLabel="Add"
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );
    expect(
      screen.getByDisplayValue('What is the sample size?')
    ).toBeInTheDocument();
  });

  it('should render the column title input with current value', () => {
    render(
      <QuestionFormFields
        reviewId={1}
        form={makeForm() as any}
        submitLabel="Add"
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('Sample Size')).toBeInTheDocument();
  });

  it('should render the submit button with the given label', () => {
    render(
      <QuestionFormFields
        reviewId={1}
        form={makeForm() as any}
        submitLabel="Save Changes"
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Save Changes' })
    ).toBeInTheDocument();
  });

  it('should disable submit button when isSubmitting is true', () => {
    render(
      <QuestionFormFields
        reviewId={1}
        form={makeForm() as any}
        submitLabel="Add"
        isSubmitting={true}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });

  it('should disable submit button when form is invalid', () => {
    render(
      <QuestionFormFields
        reviewId={1}
        form={makeForm({ isValid: false }) as any}
        submitLabel="Add"
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('should call onSubmit when submit button is clicked', async () => {
    const onSubmit = vi.fn();
    render(
      <QuestionFormFields
        reviewId={1}
        form={makeForm() as any}
        submitLabel="Add"
        isSubmitting={false}
        onSubmit={onSubmit}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('should call setQuestion when question textarea changes', async () => {
    const setQuestion = vi.fn();
    render(
      <QuestionFormFields
        reviewId={1}
        form={makeForm({ setQuestion }) as any}
        submitLabel="Add"
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );
    await userEvent.type(
      screen.getByDisplayValue('What is the sample size?'),
      '!'
    );
    expect(setQuestion).toHaveBeenCalled();
  });

  it('should show Options section when needsOptions is true', () => {
    render(
      <QuestionFormFields
        reviewId={1}
        form={
          makeForm({
            needsOptions: true,
            options: ['Option A', 'Option B'],
          }) as any
        }
        submitLabel="Add"
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText('Add Option')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Option A')).toBeInTheDocument();
  });

  it('should not show Options section when needsOptions is false', () => {
    render(
      <QuestionFormFields
        reviewId={1}
        form={makeForm({ needsOptions: false }) as any}
        submitLabel="Add"
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.queryByText('Add Option')).not.toBeInTheDocument();
  });

  it('should call handleAddOption when Add Option button is clicked', async () => {
    const handleAddOption = vi.fn();
    render(
      <QuestionFormFields
        reviewId={1}
        form={
          makeForm({
            needsOptions: true,
            options: [''],
            handleAddOption,
          }) as any
        }
        submitLabel="Add"
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText('Add Option'));
    expect(handleAddOption).toHaveBeenCalledOnce();
  });

  it('should render footer slot when provided', () => {
    render(
      <QuestionFormFields
        reviewId={1}
        form={makeForm() as any}
        submitLabel="Add"
        isSubmitting={false}
        onSubmit={vi.fn()}
        footer={<div data-testid="footer-slot">Delete</div>}
      />
    );
    expect(screen.getByTestId('footer-slot')).toBeInTheDocument();
  });

  it('should render the Required Question toggle', () => {
    render(
      <QuestionFormFields
        reviewId={1}
        form={makeForm() as any}
        submitLabel="Add"
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText('Required Question')).toBeInTheDocument();
  });
});
