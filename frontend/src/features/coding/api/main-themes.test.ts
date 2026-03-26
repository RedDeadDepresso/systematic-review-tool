import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchMainThemes,
  createMainTheme,
  updateMainTheme,
  deleteMainTheme,
} from './main-themes';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Coding API - Main Themes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchMainThemes', () => {
    it('should successfully fetch main themes', async () => {
      const mockData = [{ id: 1, name: 'Main Theme 1' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const reviewId = 123;
      const result = await fetchMainThemes(reviewId);

      expect(api.get).toHaveBeenCalledWith('/main-themes/', {
        params: { review: reviewId },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('createMainTheme', () => {
    it('should successfully create a main theme', async () => {
      const mockPayload = { name: 'New Theme', review: 123 };
      const mockResponse = { id: 2, ...mockPayload };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await createMainTheme(mockPayload);

      expect(api.post).toHaveBeenCalledWith('/main-themes/', mockPayload);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateMainTheme', () => {
    it('should successfully update a main theme', async () => {
      const payload = { name: 'Updated Theme' };
      const id = 1;
      const mockResponse = { id: 1, name: 'Updated Theme' };
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockResponse });

      const result = await updateMainTheme({ id, payload });

      expect(api.patch).toHaveBeenCalledWith(`/main-themes/${id}/`, payload);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteMainTheme', () => {
    it('should successfully delete a main theme', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: null });

      await deleteMainTheme(1);

      expect(api.delete).toHaveBeenCalledWith('/main-themes/1/');
    });
  });
});
