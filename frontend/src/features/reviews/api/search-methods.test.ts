import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import { fetchSearchMethods, deleteSearchMethod } from './search-methods';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Reviews API - Search Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchSearchMethods', () => {
    it('should accurately test configuration methods retrieving dynamic mapping components properly directly through endpoints', async () => {
      const mockData = [{ id: 1, name: 'Method 1' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchSearchMethods(10);

      expect(api.get).toHaveBeenCalledWith('/reviews/10/search-methods/');
      expect(result).toEqual(mockData);
    });
  });

  describe('deleteSearchMethod', () => {
    it('should trigger isolated deletion queries intrinsically testing structural endpoints robustly directly handling API configurations organically locally natively seamlessly', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: null });

      await deleteSearchMethod(1);

      expect(api.delete).toHaveBeenCalledWith('/search-methods/1/');
    });
  });
});
