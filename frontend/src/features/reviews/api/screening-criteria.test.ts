import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchScreeningCriteria,
  createScreeningCriteria,
  updateScreeningCriteria,
  deleteScreeningCriteria,
} from './screening-criteria';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Reviews API - Screening Criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchScreeningCriteria', () => {
    it('should natively grab configuration criteria logically', async () => {
      const mockData = [{ id: 1, name: 'Crit 1' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchScreeningCriteria({ reviewId: 10 });

      expect(api.get).toHaveBeenCalledWith('/screening-criteria/', {
        params: { review: 10 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('createScreeningCriteria', () => {
    it('should configure explicit test queries mapped to object models correctly', async () => {
      const payload = {
        review: 10,
        name: 'C1',
        description: 'Desc1',
        type: 'inclusion' as const,
      };
      const mockData = { id: 1, ...payload };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await createScreeningCriteria(payload);

      expect(api.post).toHaveBeenCalledWith('/screening-criteria/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('updateScreeningCriteria', () => {
    it('should patch elements dynamically updating configurations seamlessly', async () => {
      const payload = { name: 'C2' };
      const mockData = { id: 1, name: 'C2' };
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockData });

      const result = await updateScreeningCriteria(1, payload);

      expect(api.patch).toHaveBeenCalledWith('/screening-criteria/1/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('deleteScreeningCriteria', () => {
    it('should structurally dismount objects parsing endpoints recursively', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: null });
      await deleteScreeningCriteria(1);
      expect(api.delete).toHaveBeenCalledWith('/screening-criteria/1/');
    });
  });
});
