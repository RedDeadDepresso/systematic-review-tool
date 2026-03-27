import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import { fetchKeywords, createKeyword, deleteKeyword } from './keywords';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('References API - Keywords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchKeywords', () => {
    it('should fetch keywords', async () => {
      const mockData = [{ id: 1, name: 'KW1' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchKeywords({ reviewId: 10, type: 'inclusion' });

      expect(api.get).toHaveBeenCalledWith('/keywords/', {
        params: { reviewId: 10, type: 'inclusion' },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('createKeyword', () => {
    it('should create keyword natively', async () => {
      const payload = { review: 10, name: 'KW1', type: 'inclusion' as const };
      const mockData = { id: 1, ...payload };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await createKeyword(payload);

      expect(api.post).toHaveBeenCalledWith('/keywords/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('deleteKeyword', () => {
    it('should cleanly execute delete endpoints', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: 'success' });

      const result = await deleteKeyword(1);

      expect(api.delete).toHaveBeenCalledWith('/keywords/1/');
      expect(result).toEqual('success');
    });
  });
});
