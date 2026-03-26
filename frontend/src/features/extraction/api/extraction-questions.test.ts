import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchExtractionQuestions,
  createExtractionQuestion,
  updateExtractionQuestion,
  deleteExtractionQuestion,
} from './extraction-questions';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Extraction API - Questions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchExtractionQuestions', () => {
    it('should fetch questions with parameters', async () => {
      const mockData = [{ id: 1, question: 'Test' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchExtractionQuestions({
        reviewId: 1,
        sectionId: 2,
      });

      expect(api.get).toHaveBeenCalledWith('/extraction-questions/', {
        params: { section__review: 1, section: 2 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('createExtractionQuestion', () => {
    it('should create question properly', async () => {
      const payload = {
        section: 1,
        question: 'Q',
        columnTitle: 'C',
        type: 'free-text' as const,
        required: false,
      };
      const mockData = { id: 1, ...payload };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await createExtractionQuestion(payload);

      expect(api.post).toHaveBeenCalledWith('/extraction-questions/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('updateExtractionQuestion', () => {
    it('should update question properly', async () => {
      const payload = { question: 'Updated' };
      const mockData = { id: 1, question: 'Updated' };
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockData });

      const result = await updateExtractionQuestion(1, payload);

      expect(api.patch).toHaveBeenCalledWith(
        '/extraction-questions/1/',
        payload
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('deleteExtractionQuestion', () => {
    it('should delete question properly', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: null });

      await deleteExtractionQuestion(1);

      expect(api.delete).toHaveBeenCalledWith('/extraction-questions/1/');
    });
  });
});
