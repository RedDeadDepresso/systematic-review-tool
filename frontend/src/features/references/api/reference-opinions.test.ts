import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import { bulkUpsertReferenceOpinions } from './reference-opinions';

vi.mock('@/api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('References API - Opinions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('bulkUpsertReferenceOpinions', () => {
    it('should bulk mutate states conditionally testing arrays effectively', async () => {
      const payload = {
        referenceIds: [1, 2],
        status: 'included' as const,
        stage: 'screening' as const,
      };
      const mockData = { updated: 2 };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await bulkUpsertReferenceOpinions(payload);

      expect(api.post).toHaveBeenCalledWith(
        '/reference-opinions/bulk-upsert/',
        payload
      );
      expect(result).toEqual(mockData);
    });
  });
});
