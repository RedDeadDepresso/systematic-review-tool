import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchExtractionAnswers,
  saveExtractionAnswer,
  deleteExtractionAnswer,
  bulkSaveAnswers,
} from './extraction-answers';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Extraction API - Answers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchExtractionAnswers', () => {
    it('should fetch extraction answers', async () => {
      const mockData = [{ id: 1, value: 'Answer' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchExtractionAnswers({
        referenceId: 1,
        questionId: 2,
      });

      expect(api.get).toHaveBeenCalledWith('/extraction-answers/', {
        params: { reference: 1, question: 2 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('saveExtractionAnswer', () => {
    it('should save extraction answer', async () => {
      const payload = { reference: 1, question: 2, value: 'Answer' };
      const mockData = { id: 1, ...payload };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await saveExtractionAnswer(payload);

      expect(api.post).toHaveBeenCalledWith('/extraction-answers/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('deleteExtractionAnswer', () => {
    it('should delete extraction answer', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: null });

      await deleteExtractionAnswer(1);

      expect(api.delete).toHaveBeenCalledWith('/extraction-answers/1/');
    });
  });

  describe('bulkSaveAnswers', () => {
    it('should bulk save extraction answers', async () => {
      const payload = { referenceId: 1, answers: { 2: 'Answer' } };
      const mockData = { status: 'success' };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await bulkSaveAnswers(payload);

      expect(api.post).toHaveBeenCalledWith(
        '/extraction-answers/bulk-save/',
        payload
      );
      expect(result).toEqual(mockData);
    });
  });
});
