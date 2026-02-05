import { type ExtractionQuestion } from '@/types/extraction';
import api from './axios';

/* ------------------ FETCH EXTRACTION QUESTIONS ------------------ */
export const fetchExtractionQuestions = async (params: {
  sectionId?: number;
}) => {
  const res = await api.get<ExtractionQuestion[]>('/extraction-questions/', {
    params: params.sectionId ? { section: params.sectionId } : undefined,
  });
  return res.data;
};

/* ------------------ CREATE EXTRACTION QUESTION ------------------ */
export const createExtractionQuestion = async (payload: {
  section: number;
  question: string;
  columnTitle: string;
  type:
    | 'free-text'
    | 'number'
    | 'date'
    | 'single-select'
    | 'multi-select'
    | 'boolean';
  options?: string[];
  required: boolean;
}) => {
  const res = await api.post<ExtractionQuestion>(
    '/extraction-questions/',
    payload
  );
  return res.data;
};

/* ------------------ UPDATE EXTRACTION QUESTION ------------------ */
export const updateExtractionQuestion = async (
  questionId: number,
  payload: {
    section?: number;
    question?: string;
    columnTitle?: string;
    type?:
      | 'free-text'
      | 'number'
      | 'date'
      | 'single-select'
      | 'multi-select'
      | 'boolean';
    options?: string[];
    required?: boolean;
    order?: number;
  }
) => {
  const res = await api.patch<ExtractionQuestion>(
    `/extraction-questions/${questionId}/`,
    payload
  );
  return res.data;
};

/* ------------------ DELETE EXTRACTION QUESTION ------------------ */
export const deleteExtractionQuestion = async (questionId: number) => {
  const res = await api.delete(`/extraction-questions/${questionId}/`);
  return res.data;
};
