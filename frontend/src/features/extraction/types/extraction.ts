import type { Reference } from '@/features/references/types/references';

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
  options: string[] | null;
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
  sections: Array<{
    id: number;
    name: string;
    order: number;
    questions: Array<
      ExtractionQuestion & {
        answer: {
          id: number;
          value: string;
        } | null;
      }
    >;
  }>;
}

export interface ExtractionChanges {
  [questionId: number]: {
    oldValue: string;
    newValue: string;
  };
}
