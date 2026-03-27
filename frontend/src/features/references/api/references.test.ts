import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchReferences,
  fetchFilterCounts,
  exportReviewData,
  fetchReference,
  updateReference,
  uploadReferenceFile,
  attachPDFsToReferences,
  assignReferences,
  autoMatch,
} from './references';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('References API - References', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(),
      revokeObjectURL: vi.fn(),
    });
  });

  describe('fetchReferences', () => {
    it('should dynamically inject snake_cases into Axios cleanly', async () => {
      const mockData = { references: [], totalCount: 0 };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const params = {
        review: 10,
        searchMethodIds: [1],
        includeKeywords: ['abc'],
        limit: 10,
      };
      const result = await fetchReferences(params);

      expect(api.get).toHaveBeenCalledWith('/review-data/', {
        params: {
          review: 10,
          search_method_ids: [1],
          include_keywords: ['abc'],
          exclude_keywords: undefined,
          label_ids: undefined,
          publication_types: undefined,
          publication_years: undefined,
          has_file: undefined,
          assignee_ids: undefined,
          duplicate_statuses: undefined,
          search: undefined,
          opinion_statuses: undefined,
          is_extraction_completed: undefined,
          limit: 10,
          offset: undefined,
          ordering: undefined,
        },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('fetchFilterCounts', () => {
    it('should dynamically request review-data filtered counts generically', async () => {
      const mockData = { labels: [] };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchFilterCounts(10);

      expect(api.get).toHaveBeenCalledWith('/review-data/filter-counts/', {
        params: { review: 10 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('downloadBib and exports', () => {
    it('should generate CSV references mocking anchor node creation properly', async () => {
      const mockBlob = new Blob(['test']);
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockBlob });
      vi.mocked(window.URL.createObjectURL).mockReturnValue('mock-url');

      const mockAnchor = document.createElement('a');
      const clickSpy = vi
        .spyOn(mockAnchor, 'click')
        .mockImplementation(() => {});
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

      await exportReviewData('test.bib', { review: 10 });

      expect(api.get).toHaveBeenCalledWith('/review-data/export/', {
        params: expect.objectContaining({ review: 10 }),
        responseType: 'blob',
      });
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('fetchReference / updateReference', () => {
    it('should execute fetch realistically mapping response structurally', async () => {
      const mockData = { id: 1 };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });
      const result = await fetchReference(1);
      expect(api.get).toHaveBeenCalledWith('/references/1/');
      expect(result).toEqual(mockData);
    });

    it('should update logically using standard API abstractions securely', async () => {
      const mockData = { id: 1 };
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockData });
      const result = await updateReference({
        reviewId: 10,
        referenceId: 1,
        payload: { status: 'included' as const },
      });
      expect(api.patch).toHaveBeenCalledWith('/references/1/', {
        status: 'included',
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('uploadReferenceFile', () => {
    it('should patch multipart form configuration flawlessly testing headers intuitively', async () => {
      const formData = new FormData();
      vi.mocked(api.patch).mockResolvedValueOnce({ data: 'success' });

      const result = await uploadReferenceFile({
        reviewId: 1,
        referenceId: 10,
        formData,
      });

      expect(api.patch).toHaveBeenCalledWith('/references/10/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      expect(result).toEqual('success');
    });
  });

  describe('attachPDFsToReferences', () => {
    it('should trigger mapping logic securely building posts organically', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ data: 'done' });
      const result = await attachPDFsToReferences({
        reviewId: 10,
        mappings: [],
      });
      expect(api.post).toHaveBeenCalledWith('/references/attach-pdfs/', {
        mappings: [],
      });
      expect(result).toEqual('done');
    });
  });

  describe('assignReferences', () => {
    it('should test payload configurations seamlessly delegating users natively', async () => {
      const payload = {
        review: 10,
        referenceIds: [1, 2],
        mode: 'assign' as const,
        assigneeId: 3,
      };
      vi.mocked(api.post).mockResolvedValueOnce({ data: 'success' });

      const result = await assignReferences(payload);

      expect(api.post).toHaveBeenCalledWith('/references/assign/', payload);
      expect(result).toEqual('success');
    });
  });

  describe('autoMatch', () => {
    it('should natively map matches calculating duplicates intrinsically', async () => {
      const mockData = { matched: 1, unmatched: 0 };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await autoMatch({ reviewId: 10, referenceIds: [1] });

      expect(api.post).toHaveBeenCalledWith('/references/auto-match/', {
        reviewId: 10,
        referenceIds: [1],
      });
      expect(result).toEqual(mockData);
    });
  });
});
