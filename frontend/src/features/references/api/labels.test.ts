import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  assignLabelsToReferences,
} from './labels';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('References API - Labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchLabels', () => {
    it('should fetch definitions', async () => {
      const mockData = [{ id: 1, name: 'L1' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchLabels();

      expect(api.get).toHaveBeenCalledWith('/labels/');
      expect(result).toEqual(mockData);
    });
  });

  describe('createLabel', () => {
    it('should create label definitions organically', async () => {
      const payload = { name: 'L1' };
      const mockData = { id: 1, ...payload };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await createLabel(payload);

      expect(api.post).toHaveBeenCalledWith('/labels/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('updateLabel', () => {
    it('should dynamically update definitions securely', async () => {
      const payload = { name: 'L2' };
      const mockData = { id: 1, name: 'L2' };
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockData });

      const result = await updateLabel({ id: 1, payload });

      expect(api.patch).toHaveBeenCalledWith('/labels/1/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('deleteLabel', () => {
    it('should functionally unmount schemas reliably', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: null });

      await deleteLabel(1);

      expect(api.delete).toHaveBeenCalledWith('/labels/1/');
    });
  });

  describe('assignLabelsToReferences', () => {
    it('should correctly configure relationships testing payloads logically', async () => {
      const payload = {
        review: 1,
        referenceIds: [2],
        checkedLabelIds: [3],
        indeterminateLabelIds: [4],
      };
      const mockData = { created: 1, deleted: 0 };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await assignLabelsToReferences(payload);

      expect(api.post).toHaveBeenCalledWith(
        '/labels/assign-to-references/',
        payload
      );
      expect(result).toEqual(mockData);
    });
  });
});
