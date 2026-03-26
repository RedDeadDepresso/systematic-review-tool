import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchReviewMembers,
  updateReviewMember,
  deleteReviewMember,
} from './review-members';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Reviews API - Members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchReviewMembers', () => {
    it('should dynamically list internal reviewer bindings robustly', async () => {
      const mockData = [{ id: 1, userId: 2 }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchReviewMembers(10);

      expect(api.get).toHaveBeenCalledWith('/reviews/10/members/');
      expect(result).toEqual(mockData);
    });
  });

  describe('updateReviewMember', () => {
    it('should patch member properties intelligently linking domains successfully', async () => {
      const payload = { role: 'reviewer' as const };
      const mockData = { id: 1, role: 'reviewer' };
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockData });

      const result = await updateReviewMember(1, payload);

      expect(api.patch).toHaveBeenCalledWith('/review-members/1/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('deleteReviewMember', () => {
    it('should delete reviewer bindings elegantly mutating logic optimally', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: 'success' });

      await deleteReviewMember(1);

      expect(api.delete).toHaveBeenCalledWith('/review-members/1/');
    });
  });
});
