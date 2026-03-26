import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  createReview,
  fetchReviews,
  fetchReview,
  createReviewPrisma,
  updateReview,
  deleteReview,
  UploadReviewReferences,
  fetchArticleCounts,
  addData,
  downloadLatexFile,
  downloadJsonFile,
  autoResolveDuplicates,
} from './reviews';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Reviews API - Reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(),
      revokeObjectURL: vi.fn(),
    });
  });

  describe('createReview / updateReview / deleteReview', () => {
    it('should test CRUD capabilities generating models gracefully', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ data: { id: 1 } });
      await createReview({ title: 'T1', description: 'D1' });
      expect(api.post).toHaveBeenCalledWith('/reviews/', {
        title: 'T1',
        description: 'D1',
      });

      vi.mocked(api.patch).mockResolvedValueOnce({ data: { id: 1 } });
      await updateReview({ id: 1, payload: { title: 'T2' } });
      expect(api.patch).toHaveBeenCalledWith('/reviews/1/', { title: 'T2' });

      vi.mocked(api.delete).mockResolvedValueOnce({ data: null });
      await deleteReview({ id: 1 });
      expect(api.delete).toHaveBeenCalledWith('/reviews/1/');
    });
  });

  describe('fetchReviews / fetchReview / fetchArticleCounts', () => {
    it('should test fetches accurately resolving API endpoints reliably', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: [] });
      await fetchReviews({ isActive: true });
      expect(api.get).toHaveBeenCalledWith('/reviews/', {
        params: { is_active: true },
      });

      vi.mocked(api.get).mockResolvedValueOnce({ data: { id: 1 } });
      await fetchReview(1);
      expect(api.get).toHaveBeenCalledWith('/reviews/1/');

      vi.mocked(api.get).mockResolvedValueOnce({ data: { count: 5 } });
      await fetchArticleCounts(1, { stage: 'screening' });
      expect(api.get).toHaveBeenCalledWith('/reviews/1/article-counts/', {
        params: { stage: 'screening' },
      });
    });
  });

  describe('createReviewPrisma', () => {
    it('should generate Prisma metrics robustly', async () => {
      const mockPrisma = { fileUrl: 'x', data: {} } as any;
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockPrisma });
      const result = await createReviewPrisma(1);
      expect(api.post).toHaveBeenCalledWith('/reviews/1/prisma/');
      expect(result).toEqual(mockPrisma);
    });
  });

  describe('download functions', () => {
    it('should assert mocked dom elements downloading payload sequentially', async () => {
      const mockBlob = new Blob(['x']);
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockBlob });
      vi.mocked(window.URL.createObjectURL).mockReturnValue('mock-url');
      const mockAnchor = document.createElement('a');
      const clickSpy = vi
        .spyOn(mockAnchor, 'click')
        .mockImplementation(() => {});
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

      await downloadLatexFile(1);

      expect(clickSpy).toHaveBeenCalled();
      expect(api.get).toHaveBeenCalledWith(
        '/reviews/1/export-latex/?download=true',
        { responseType: 'blob' }
      );
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
    });

    it('should assert mocked DOM testing json blob natively', async () => {
      const mockBlob = new Blob(['{}']);
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockBlob });
      vi.mocked(window.URL.createObjectURL).mockReturnValue('mock-url');
      const mockAnchor = document.createElement('a');
      const clickSpy = vi
        .spyOn(mockAnchor, 'click')
        .mockImplementation(() => {});
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

      await downloadJsonFile(1);

      expect(clickSpy).toHaveBeenCalled();
      expect(api.get).toHaveBeenCalledWith(
        '/reviews/1/export-json/?download=true',
        { responseType: 'blob' }
      );
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
    });
  });

  describe('UploadReviewReferences / addData / autoResolveDuplicates', () => {
    it('should accurately test reference uploads securely wrapping configurations', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ data: 'ok' });
      await UploadReviewReferences({ reviewId: 1, formData: new FormData() });
      expect(api.post).toHaveBeenCalledWith(
        '/reviews/1/upload-references/',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      vi.mocked(api.post).mockResolvedValueOnce({ data: 'ok' });
      await addData(1, {
        dataSource: 's1',
        dataSink: 's2',
        articleTypes: [],
        labelIds: [],
      });
      expect(api.post).toHaveBeenCalledWith('/reviews/1/add-data/', {
        dataSource: 's1',
        dataSink: 's2',
        articleTypes: [],
        labelIds: [],
      });

      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          message: 'ok',
          taskId: '1',
          confidenceThreshold: 0.9,
          status: 'run',
        },
      });
      await autoResolveDuplicates(1, { confidenceThreshold: 0.9 });
      expect(api.post).toHaveBeenCalledWith(
        '/reviews/1/auto-resolve-duplicates/',
        { confidenceThreshold: 0.9 }
      );
    });
  });
});
