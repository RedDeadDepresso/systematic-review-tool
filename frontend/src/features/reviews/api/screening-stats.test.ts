import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchScreeningStats,
  fetchScreeningOpinions,
  fetchFullTextOpinions,
} from './screening-stats';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('Reviews API - Screening Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchScreeningStats', () => {
    it('should effectively map statistical derivations internally explicitly testing API endpoints locally', async () => {
      const mockData = [{ status: 'included', count: 1 }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchScreeningStats(10);

      expect(api.get).toHaveBeenCalledWith('/reviews/10/screening-stats/');
      expect(result).toEqual(mockData);
    });
  });

  describe('fetchScreeningOpinions', () => {
    it('should properly grab screening opinions recursively defining configurations consistently', async () => {
      const mockData = [{ opinion: 'positive', count: 1 }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchScreeningOpinions(10);

      expect(api.get).toHaveBeenCalledWith('/reviews/10/screening-opinions/');
      expect(result).toEqual(mockData);
    });
  });

  describe('fetchFullTextOpinions', () => {
    it('should evaluate and capture full-text responses generating endpoints cleanly parsing queries gracefully', async () => {
      const mockData = [{ opinion: 'negative', count: 1 }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchFullTextOpinions(10);

      expect(api.get).toHaveBeenCalledWith('/reviews/10/full-text-opinions/');
      expect(result).toEqual(mockData);
    });
  });
});
