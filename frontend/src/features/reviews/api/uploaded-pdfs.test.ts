import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchUploadedPDFs,
  uploadPDF,
  deleteUploadedPDF,
} from './uploaded-pdfs';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Reviews API - Uploaded PDFs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchUploadedPDFs', () => {
    it('should successfully fetch uploaded PDF definitions', async () => {
      const mockData = [{ id: 1, filename: 'doc.pdf' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchUploadedPDFs(10);

      expect(api.get).toHaveBeenCalledWith('/uploaded-pdfs/', {
        params: { review: 10 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('uploadPDF', () => {
    it('should process multi-part form payloads injecting forms precisely', async () => {
      const mockFile = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      });
      const mockData = { id: 1, filename: 'test.pdf' };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await uploadPDF({ file: mockFile, review: 10 });

      expect(api.post).toHaveBeenCalledWith(
        '/uploaded-pdfs/',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('deleteUploadedPDF', () => {
    it('should strip entity physically deleting safely', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: null });

      await deleteUploadedPDF(1);

      expect(api.delete).toHaveBeenCalledWith('/uploaded-pdfs/1/');
    });
  });
});
