import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchExtractionTableData,
  batchUpdateAnswers,
  saveExtractionAnswer,
  downloadCSVFile,
  bulkUpdateExtractionStatus,
} from './extraction-table';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Extraction API - Table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(),
      revokeObjectURL: vi.fn(),
    });
  });

  describe('fetchExtractionTableData', () => {
    it('should fetch extraction table data successfully', async () => {
      const mockData = { data: 'test' };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchExtractionTableData(10);

      expect(api.get).toHaveBeenCalledWith('/extraction/table-data/', {
        params: { review: 10 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('batchUpdateAnswers', () => {
    it('should batch update answers securely', async () => {
      const answers = [{ reference: 1, question: 2, value: 'V1' }];
      const mockData = { updated: 1 };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await batchUpdateAnswers(answers);

      expect(api.post).toHaveBeenCalledWith(
        '/extraction-answers/batch-update/',
        { answers }
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('saveExtractionAnswer', () => {
    it('should test single post extraction fallback explicitly', async () => {
      const payload = { reference: 1, question: 2, value: 'v' };
      const mockData = { id: 1, ...payload };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await saveExtractionAnswer(payload);

      expect(api.post).toHaveBeenCalledWith('/extraction-answers/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('downloadCSVFile', () => {
    it('should fetch and mock blob natively to dom node elements simulating click safely', async () => {
      const mockBlob = new Blob(['test']);
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockBlob });
      vi.mocked(window.URL.createObjectURL).mockReturnValue('mock-url');

      const mockAnchor = document.createElement('a');
      const clickSpy = vi
        .spyOn(mockAnchor, 'click')
        .mockImplementation(() => {});
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

      await downloadCSVFile(10);

      expect(api.get).toHaveBeenCalledWith(
        '/extraction/export-csv/?review_id=10',
        {
          responseType: 'blob',
        }
      );
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(clickSpy).toHaveBeenCalled();
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
    });
  });

  describe('bulkUpdateExtractionStatus', () => {
    it('should bulk update statuses systematically testing axios mocks securely', async () => {
      const payload = { referenceIds: [1, 2], isExtractionCompleted: true };
      const mockData = { status: 'success' };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await bulkUpdateExtractionStatus(payload);

      expect(api.post).toHaveBeenCalledWith(
        '/extraction/bulk-update-status/',
        payload
      );
      expect(result).toEqual(mockData);
    });
  });
});
