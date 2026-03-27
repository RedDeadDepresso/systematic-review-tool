import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchExtractionSections,
  createExtractionSection,
  updateExtractionSection,
  deleteExtractionSection,
  fetchExtractionFormData,
} from './extraction-sections';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Extraction API - Sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchExtractionSections', () => {
    it('should cleanly fetch extraction sections', async () => {
      const mockData = [{ id: 1, name: 'S1' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchExtractionSections({ reviewId: 10 });

      expect(api.get).toHaveBeenCalledWith('/extraction-sections/', {
        params: { review: 10 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('createExtractionSection', () => {
    it('should create section properly', async () => {
      const payload = { review: 1, name: 'S1' };
      const mockData = { id: 1, ...payload };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await createExtractionSection(payload);

      expect(api.post).toHaveBeenCalledWith('/extraction-sections/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('updateExtractionSection', () => {
    it('should update section properly', async () => {
      const payload = { name: 'S2' };
      const mockData = { id: 1, name: 'S2' };
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockData });

      const result = await updateExtractionSection(1, payload);

      expect(api.patch).toHaveBeenCalledWith(
        '/extraction-sections/1/',
        payload
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('deleteExtractionSection', () => {
    it('should delete a section properly', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: null });

      await deleteExtractionSection(1);

      expect(api.delete).toHaveBeenCalledWith('/extraction-sections/1/');
    });
  });

  describe('fetchExtractionFormData', () => {
    it('should fetch extraction form data successfully', async () => {
      const mockData = { answers: [] };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchExtractionFormData(1, 10);

      expect(api.get).toHaveBeenCalledWith('/extraction-form/form-data/', {
        params: { referenceId: 1, reviewId: 10 },
      });
      expect(result).toEqual(mockData);
    });
  });
});
