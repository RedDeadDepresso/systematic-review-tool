import type { Reference } from './reference';

// Data extraction types
export type QuestionType =
  | 'free-text'
  | 'number'
  | 'date'
  | 'single-select'
  | 'multi-select'
  | 'boolean';

export type ExtractionSection = {
  id: number;
  name: string;
};

export type ExtractionQuestion = {
  id: number;
  section: number;
  question: string;
  columnTitle: string;
  type: QuestionType;
  required: boolean;
};

export type ExtractionAnswer = {
  id: number;
  reference: number;
  question: number;
  value: string;
};

export interface ReferenceWithAnswers extends Reference {
  answers: Record<number, ExtractionAnswer>; // questionId -> answer
  isExtractionCompleted: boolean;
}

export interface ExtractionTableData {
  questions: ExtractionQuestion[];
  references: ReferenceWithAnswers[];
}

export type ExtractionStatus = 'in-progress' | 'completed';

export interface ExtractionFormData {
  [questionId: number]: string | string[]; // Support both single and multi-value
}

export interface ExtractionChanges {
  [questionId: number]: {
    oldValue: string;
    newValue: string;
  };
}
