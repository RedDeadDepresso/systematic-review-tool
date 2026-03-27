import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import { fetchCodes, createCode, updateCode, deleteCode } from './codes';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Coding API - Codes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchCodes', () => {
    it('should successfully fetch codes', async () => {
      const mockData = [{ id: '1', name: 'Code 1' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const reviewId = 123;
      const result = await fetchCodes(reviewId);

      expect(api.get).toHaveBeenCalledWith('/codes/', {
        params: { review: reviewId },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('createCode', () => {
    it('should successfully create a code', async () => {
      const mockPayload = { name: 'New Code', review: 123 };
      const mockResponse = { id: '2', ...mockPayload };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await createCode(mockPayload);

      expect(api.post).toHaveBeenCalledWith('/codes/', mockPayload);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateCode', () => {
    it('should successfully update a code', async () => {
      const payload = { name: 'Updated Name' };
      const id = '1';
      const mockResponse = { id: '1', name: 'Updated Name' };
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockResponse });

      const result = await updateCode({ id, payload });

      expect(api.patch).toHaveBeenCalledWith(`/codes/${id}/`, payload);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteCode', () => {
    it('should successfully delete a code', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: null });

      await deleteCode('1');

      expect(api.delete).toHaveBeenCalledWith('/codes/1/');
    });
  });
});
