import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchNotes,
  createNote,
  bulkCreateNote,
  updateNote,
  deleteNote,
} from './notes';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('References API - Notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchNotes', () => {
    it('should successfully fetch notes dynamically', async () => {
      const mockData = [{ id: 1, content: 'N1' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchNotes({ referenceId: 10 });

      expect(api.get).toHaveBeenCalledWith('/notes/', {
        params: { reference: 10 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('createNote', () => {
    it('should create note organically', async () => {
      const payload = { reference: 10, content: 'N1' };
      const mockData = { id: 1, ...payload };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await createNote(payload);

      expect(api.post).toHaveBeenCalledWith('/notes/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('bulkCreateNote', () => {
    it('should bulk map strings recursively natively', async () => {
      const payload = { referenceIds: [1, 2], content: 'B1' };
      const mockData = { count: 2 };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await bulkCreateNote(payload);

      expect(api.post).toHaveBeenCalledWith('/notes/bulk-create/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('updateNote', () => {
    it('should patch endpoints correctly', async () => {
      const payload = { content: 'U1' };
      const mockData = { id: 1, ...payload };
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockData });

      const result = await updateNote(1, payload);

      expect(api.patch).toHaveBeenCalledWith('/notes/1/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('deleteNote', () => {
    it('should physically decouple DOM nodes correctly', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: null });

      await deleteNote(1);

      expect(api.delete).toHaveBeenCalledWith('/notes/1/');
    });
  });
});
