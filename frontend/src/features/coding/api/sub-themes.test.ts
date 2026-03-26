import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchSubThemes,
  createSubTheme,
  updateSubTheme,
  deleteSubTheme,
} from './sub-themes';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Coding API - Sub Themes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchSubThemes', () => {
    it('should successfully fetch sub themes', async () => {
      const mockData = [{ id: 1, name: 'Sub Theme 1' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const reviewId = 123;
      const result = await fetchSubThemes(reviewId);

      expect(api.get).toHaveBeenCalledWith('/sub-themes/', {
        params: { review: reviewId },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('createSubTheme', () => {
    it('should successfully create a sub theme', async () => {
      const mockPayload = { name: 'New Sub Theme', review: 123 };
      const mockResponse = { id: 2, ...mockPayload };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await createSubTheme(mockPayload);

      expect(api.post).toHaveBeenCalledWith('/sub-themes/', mockPayload);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateSubTheme', () => {
    it('should successfully update a sub theme', async () => {
      const payload = { name: 'Updated Sub Theme' };
      const id = 1;
      const mockResponse = { id: 1, name: 'Updated Sub Theme' };
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockResponse });

      const result = await updateSubTheme({ id, payload });

      expect(api.patch).toHaveBeenCalledWith(`/sub-themes/${id}/`, payload);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteSubTheme', () => {
    it('should successfully delete a sub theme', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: null });

      await deleteSubTheme(1);

      expect(api.delete).toHaveBeenCalledWith(`/sub-themes/1/`);
    });
  });
});
