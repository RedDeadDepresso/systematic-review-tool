import { useState } from 'react';
import type { QuestionType } from '@/features/extraction/types/extraction';

export interface QuestionFormState {
  sectionId: number | null;
  question: string;
  questionType: QuestionType;
  columnTitle: string;
  required: boolean;
  options: string[];
}

const DEFAULT_STATE: QuestionFormState = {
  sectionId: null,
  question: '',
  questionType: 'free-text',
  columnTitle: '',
  required: false,
  options: [''],
};

export function useQuestionForm(initial: Partial<QuestionFormState> = {}) {
  const [sectionId, setSectionId] = useState<number | null>(
    initial.sectionId ?? DEFAULT_STATE.sectionId
  );
  const [question, setQuestion] = useState(
    initial.question ?? DEFAULT_STATE.question
  );
  const [questionType, setQuestionType] = useState<QuestionType>(
    initial.questionType ?? DEFAULT_STATE.questionType
  );
  const [columnTitle, setColumnTitle] = useState(
    initial.columnTitle ?? DEFAULT_STATE.columnTitle
  );
  const [required, setRequired] = useState(
    initial.required ?? DEFAULT_STATE.required
  );
  const [options, setOptions] = useState<string[]>(
    initial.options?.length ? initial.options : DEFAULT_STATE.options
  );

  const reset = (values: Partial<QuestionFormState> = {}) => {
    setSectionId(values.sectionId ?? DEFAULT_STATE.sectionId);
    setQuestion(values.question ?? DEFAULT_STATE.question);
    setQuestionType(values.questionType ?? DEFAULT_STATE.questionType);
    setColumnTitle(values.columnTitle ?? DEFAULT_STATE.columnTitle);
    setRequired(values.required ?? DEFAULT_STATE.required);
    setOptions(values.options?.length ? values.options : DEFAULT_STATE.options);
  };

  const handleTypeChange = (newType: QuestionType) => {
    setQuestionType(newType);
    if (
      (newType === 'single-select' || newType === 'multi-select') &&
      options.length === 0
    ) {
      setOptions(['']);
    }
  };

  const handleAddOption = () => setOptions((prev) => [...prev, '']);

  const handleRemoveOption = (index: number) => {
    if (options.length > 1) {
      setOptions((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const needsOptions =
    questionType === 'single-select' || questionType === 'multi-select';
  const validOptions = options.filter((opt) => opt.trim().length > 0);

  const isValid =
    sectionId !== null &&
    question.trim().length > 0 &&
    columnTitle.trim().length > 0 &&
    (!needsOptions || validOptions.length > 0);

  return {
    // State
    sectionId,
    question,
    questionType,
    columnTitle,
    required,
    options,
    // Setters
    setSectionId,
    setQuestion,
    setColumnTitle,
    setRequired,
    // Handlers
    handleTypeChange,
    handleAddOption,
    handleRemoveOption,
    handleOptionChange,
    reset,
    // Derived
    needsOptions,
    validOptions,
    isValid,
  };
}
