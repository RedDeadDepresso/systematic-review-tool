import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  fetchDuplicateClusters,
  fetchDuplicateCluster,
  resolveCluster,
  dismissCluster,
  fetchClusterStats,
  autoResolveDuplicates,
} from './reference-clusters';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('References API - Clusters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchDuplicateClusters', () => {
    it('should retrieve list configurations correctly binding options implicitly', async () => {
      const mockResponse = {
        clusters: [],
        resolved: 0,
        remaining: 0,
        total: 0,
        progress: 0,
      };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse });

      const result = await fetchDuplicateClusters({
        reviewId: 10,
        status: 'unresolved',
      });

      expect(api.get).toHaveBeenCalledWith('/duplicate-clusters/', {
        params: { review: 10, status: 'unresolved' },
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('fetchDuplicateCluster', () => {
    it('should natively pull clusters by UUID definitions organically', async () => {
      const mockData = { id: 'uuid-1', status: 'unresolved' };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchDuplicateCluster('uuid-1');

      expect(api.get).toHaveBeenCalledWith('/duplicate-clusters/uuid-1/');
      expect(result).toEqual(mockData);
    });
  });

  describe('resolveCluster', () => {
    it('should submit canonical definitions to resolution payloads strictly', async () => {
      const mockResponse = {
        message: 'resolved',
        clusterId: 'uuid-1',
        canonicalReferenceId: 2,
      };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await resolveCluster('uuid-1', 2);

      expect(api.post).toHaveBeenCalledWith(
        '/duplicate-clusters/uuid-1/resolve/',
        { canonicalReferenceId: 2 }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('dismissCluster', () => {
    it('should dismiss cleanly decoupling unresolvable schemas properly', async () => {
      const mockResponse = { message: 'dismissed', clusterId: 'uuid-1' };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await dismissCluster('uuid-1');

      expect(api.post).toHaveBeenCalledWith(
        '/duplicate-clusters/uuid-1/dismiss/'
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('fetchClusterStats', () => {
    it('should retrieve global reporting statistics successfully mapping fields', async () => {
      const mockStats = {
        unresolved: 1,
        autoResolved: 0,
        manuallyResolved: 0,
        dismissed: 0,
        affectedReferences: 2,
      };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockStats });

      const result = await fetchClusterStats(10);

      expect(api.get).toHaveBeenCalledWith('/duplicate-clusters/stats/', {
        params: { review: 10 },
      });
      expect(result).toEqual(mockStats);
    });
  });

  describe('autoResolveDuplicates', () => {
    it('should trigger custom bulk jobs testing boolean configurations properly', async () => {
      const params = {
        confidenceThreshold: 0.9,
        detectFirst: true,
        fuzzyThreshold: 0.8,
        doiClustersAlways: false,
        preferredSearchMethodId: null,
      };
      const mockResponse = {
        message: 'started',
        taskId: 't1',
        status: 'run',
        confidenceThreshold: 0.9,
        fuzzyThreshold: 0.8,
        doiClustersAlways: false,
        preferredSearchMethodId: null,
      };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await autoResolveDuplicates(10, params);

      expect(api.post).toHaveBeenCalledWith(
        '/reviews/10/auto-resolve-duplicates/',
        params
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
