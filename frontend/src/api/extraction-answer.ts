import { type ExtractionAnswer } from '@/types/extraction';
import api from './axios';

/* ------------------ FETCH EXTRACTION ANSWERS ------------------ */
export const fetchExtractionAnswers = async (params: {
  referenceId?: number;
  questionId?: number;
}) => {
  const res = await api.get<ExtractionAnswer[]>('/extraction-answers/', {
    params: {
      reference: params.referenceId,
      question: params.questionId,
    },
  });
  return res.data;
};

/* ------------------ CREATE/UPDATE EXTRACTION ANSWER ------------------ */
export const saveExtractionAnswer = async (payload: {
  reference: number;
  question: number;
  value: string;
}) => {
  const res = await api.post<ExtractionAnswer>('/extraction-answers/', payload);
  return res.data;
};

/* ------------------ DELETE EXTRACTION ANSWER ------------------ */
export const deleteExtractionAnswer = async (answerId: number) => {
  const res = await api.delete(`/extraction-answers/${answerId}/`);
  return res.data;
};
