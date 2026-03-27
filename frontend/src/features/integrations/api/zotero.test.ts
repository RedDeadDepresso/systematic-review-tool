import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  getZoteroIntegration,
  createZoteroIntegration,
  updateZoteroIntegration,
  resetSyncData,
  deleteZoteroIntegration,
  getDeletionPreview,
  getZoteroStatus,
  getZoteroCollections,
  setZoteroCollection,
  createZoteroCollection,
  pushToZotero,
  pullFromZotero,
} from './zotero';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Integrations API - Zotero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getZoteroIntegration', () => {
    it('should fetch Zotero integration', async () => {
      const mockIntegration = { id: 1, library_id: 'lib123' };
      vi.mocked(api.get).mockResolvedValueOnce({ data: [mockIntegration] });

      const result = await getZoteroIntegration(10);

      expect(api.get).toHaveBeenCalledWith('/zotero-integrations/?review=10');
      expect(result).toEqual(mockIntegration);
    });

    it('should return null if no integration found', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: [] });

      const result = await getZoteroIntegration(10);

      expect(api.get).toHaveBeenCalledWith('/zotero-integrations/?review=10');
      expect(result).toBeNull();
    });
  });

  describe('createZoteroIntegration', () => {
    it('should create Zotero integration', async () => {
      const payload = {
        review: 10,
        libraryId: 'lib123',
        apiKey: 'key',
        libraryType: 'user' as const,
      };
      const mockResponse = { id: 1, ...payload };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await createZoteroIntegration(payload);

      expect(api.post).toHaveBeenCalledWith('/zotero-integrations/', payload);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateZoteroIntegration', () => {
    it('should update Zotero integration converting camelCase cleanly', async () => {
      const payload = { libraryId: 'lib456', syncAction: 'keep' as const };
      const mockResponse = { id: 1 };
      vi.mocked(api.put).mockResolvedValueOnce({ data: mockResponse });

      const result = await updateZoteroIntegration(1, payload);

      expect(api.put).toHaveBeenCalledWith('/zotero-integrations/1/', {
        library_id: 'lib456',
        api_key: undefined,
        library_type: undefined,
        sync_action: 'keep',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('resetSyncData', () => {
    it('should reset sync data', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ data: 'success' });

      const result = await resetSyncData(1, 'reset', true);

      expect(api.post).toHaveBeenCalledWith(
        '/zotero-integrations/1/reset_sync_data/',
        { action: 'reset', confirm: true }
      );
      expect(result).toEqual('success');
    });
  });

  describe('deleteZoteroIntegration', () => {
    it('should delete zotero integration cleanly', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: 'success' });

      const result = await deleteZoteroIntegration(1, 'unlink', true);

      expect(api.delete).toHaveBeenCalledWith(
        '/zotero-integrations/1/?action=unlink&confirm=true'
      );
      expect(result).toEqual('success');
    });
  });

  describe('getDeletionPreview', () => {
    it('should fetch deletion preview', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: 'preview' });

      const result = await getDeletionPreview(1);

      expect(api.get).toHaveBeenCalledWith(
        '/zotero-integrations/1/deletion_preview/'
      );
      expect(result).toEqual('preview');
    });
  });

  describe('getZoteroStatus', () => {
    it('should fetch status', async () => {
      const mockStatus = { isConfigured: true };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockStatus });

      const result = await getZoteroStatus(1);

      expect(api.get).toHaveBeenCalledWith('/zotero-integrations/1/status/');
      expect(result).toEqual(mockStatus);
    });
  });

  describe('getZoteroCollections', () => {
    it('should fetch collections unwrapping data.collections', async () => {
      const mockCollections = [{ key: 'col1' }];
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { collections: mockCollections },
      });

      const result = await getZoteroCollections(1);

      expect(api.get).toHaveBeenCalledWith(
        '/zotero-integrations/1/collections/'
      );
      expect(result).toEqual(mockCollections);
    });
  });

  describe('setZoteroCollection', () => {
    it('should set zotero collection securely', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ data: 'success' });

      const result = await setZoteroCollection(1, 'key1', 'name1', 'keep');

      expect(api.post).toHaveBeenCalledWith(
        '/zotero-integrations/1/set_collection/',
        {
          collection_key: 'key1',
          collection_name: 'name1',
          sync_action: 'keep',
        }
      );
      expect(result).toEqual('success');
    });
  });

  describe('createZoteroCollection', () => {
    it('should create zotero collection natively', async () => {
      const params = { name: 'col1', parentCollection: 'parent' };
      const mockResponse = {
        message: 'created',
        collection: { key: 'c1', name: 'col1', version: 1 },
      };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await createZoteroCollection(1, params);

      expect(api.post).toHaveBeenCalledWith(
        '/zotero-integrations/1/create_collection/',
        params
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('pushToZotero', () => {
    it('should trigger push organically', async () => {
      const mockResponse = {
        message: 'pushed',
        taskId: 't1',
        status: 'done',
        totalUnpushed: 0,
      };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await pushToZotero(1, true);

      expect(api.post).toHaveBeenCalledWith('/zotero-integrations/1/push/', {
        confirm: true,
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('pullFromZotero', () => {
    it('should trigger pull synchronously mapped', async () => {
      const mockResponse = { message: 'pulled', taskId: 't2', status: 'done' };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await pullFromZotero(1, true);

      expect(api.post).toHaveBeenCalledWith('/zotero-integrations/1/pull/', {
        force: true,
      });
      expect(result).toEqual(mockResponse);
    });
  });
});
