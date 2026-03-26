import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchReasons,
  createReason,
  updateReason,
  deleteReason,
} from './reasons';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('References API - Reasons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchReasons', () => {
    it('should properly grab parameters dynamically mapping values securely', async () => {
      const mockData = [{ id: 1, name: 'R1' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchReasons({ reviewId: 10 });

      expect(api.get).toHaveBeenCalledWith('/reasons/', {
        params: { review: 10 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('createReason', () => {
    it('should implement mock payloads generically', async () => {
      const payload = { review: 10, name: 'R1' };
      const mockData = { id: 1, ...payload };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await createReason(payload);

      expect(api.post).toHaveBeenCalledWith('/reasons/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('updateReason', () => {
    it('should deploy patches natively configuring references dynamically', async () => {
      const payload = { name: 'R2' };
      const mockData = { id: 1, ...payload };
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockData });

      const result = await updateReason(1, payload);

      expect(api.patch).toHaveBeenCalledWith('/reasons/1/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('deleteReason', () => {
    it('should explicitly evaluate void schemas mapping logically', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: 'success' });

      const result = await deleteReason(1);

      expect(api.delete).toHaveBeenCalledWith('/reasons/1/');
      expect(result).toEqual('success');
    });
  });
});
