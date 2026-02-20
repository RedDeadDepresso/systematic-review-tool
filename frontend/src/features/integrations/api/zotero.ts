import api from '../../../api/client';

export interface ZoteroIntegration {
  id: number;
  review: number;
  libraryId: string;
  libraryType: 'user' | 'group';
  collectionKey: string | null;
  collectionName: string | null;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastSyncVersion: number;
  isActive: boolean;
  isConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ZoteroStatus {
  isConfigured: boolean;
  libraryType: string;
  collectionKey: string | null;
  collectionName: string | null;
  lastPush: string | null;
  lastPull: string | null;
  lastSyncVersion: number;
  totalReferences: number;
  syncedReferences: number;
  referencesWithPdfs: number;
  recentSyncs: any[];
}

export interface ZoteroCollection {
  key: string;
  version: number;
  name: string;
  parentCollection?: string;
}

// ============================================================================
// Integration Management
// ============================================================================

export const getZoteroIntegration = async (reviewId: number) => {
  const res = await api.get<ZoteroIntegration[]>(
    `/zotero-integrations/?review=${reviewId}`
  );
  return res.data[0] || null;
};

export const createZoteroIntegration = async (payload: {
  review: number;
  libraryId: string;
  apiKey: string;
  libraryType: 'user' | 'group';
  collectionKey?: string;
  collectionName?: string;
}) => {
  const res = await api.post<ZoteroIntegration>(
    '/zotero-integrations/',
    payload
  );
  return res.data;
};

export const updateZoteroIntegration = async (
  integrationId: number,
  payload: {
    libraryId?: string;
    apiKey?: string;
    libraryType?: 'user' | 'group';
    syncAction?: 'keep' | 'reset' | 'unlink';
  }
) => {
  const res = await api.put<ZoteroIntegration>(
    `/zotero-integrations/${integrationId}/`,
    {
      library_id: payload.libraryId,
      api_key: payload.apiKey,
      library_type: payload.libraryType,
      sync_action: payload.syncAction,
    }
  );
  return res.data;
};

export const resetSyncData = async (
  integrationId: number,
  action: 'reset' | 'unlink',
  confirm: boolean = true
) => {
  const res = await api.post(
    `/zotero-integrations/${integrationId}/reset_sync_data/`,
    {
      action,
      confirm,
    }
  );
  return res.data;
};

export const deleteZoteroIntegration = async (
  integrationId: number,
  action: 'keep' | 'unlink' | 'reset' = 'keep',
  confirm: boolean = false
) => {
  const params = new URLSearchParams();
  params.append('action', action);
  if (confirm) params.append('confirm', 'true');

  const res = await api.delete(
    `/zotero-integrations/${integrationId}/?${params.toString()}`
  );
  return res.data;
};

export const getDeletionPreview = async (integrationId: number) => {
  const res = await api.get(
    `/zotero-integrations/${integrationId}/deletion_preview/`
  );
  return res.data;
};

// ============================================================================
// Status & Collections
// ============================================================================

export const getZoteroStatus = async (integrationId: number) => {
  const res = await api.get<ZoteroStatus>(
    `/zotero-integrations/${integrationId}/status/`
  );
  return res.data;
};

export const getZoteroCollections = async (integrationId: number) => {
  const res = await api.get<{ collections: ZoteroCollection[] }>(
    `/zotero-integrations/${integrationId}/collections/`
  );
  return res.data.collections;
};

export const setZoteroCollection = async (
  integrationId: number,
  collectionKey: string | null,
  collectionName: string | null,
  syncAction?: 'keep' | 'unlink' | 'reset'
) => {
  const res = await api.post(
    `/zotero-integrations/${integrationId}/set_collection/`,
    {
      collection_key: collectionKey,
      collection_name: collectionName,
      sync_action: syncAction,
    }
  );
  return res.data;
};

export const createZoteroCollection = async (
  integrationId: number,
  params: {
    name: string;
    parentCollection?: string;
    setAsDefault?: boolean;
  }
) => {
  const res = await api.post<{
    message: string;
    collection: {
      key: string;
      name: string;
      version: number;
    };
  }>(`/zotero-integrations/${integrationId}/create_collection/`, params);
  return res.data;
};

// ============================================================================
// Sync Operations
// ============================================================================

export const pushToZotero = async (
  integrationId: number,
  confirm?: boolean
) => {
  const res = await api.post<{
    message: string;
    taskId: string;
    status: string;
    totalUnpushed: number;
    estimatedBatches?: number;
    warning?: string;
    estimatedTimeMinutes?: number;
  }>(
    `/zotero-integrations/${integrationId}/push/`,
    confirm ? { confirm: true } : {}
  );
  return res.data;
};

export const pullFromZotero = async (
  integrationId: number,
  force?: boolean
) => {
  const res = await api.post<{
    message: string;
    taskId: string;
    status: string;
  }>(`/zotero-integrations/${integrationId}/pull/`, {
    force: force ?? false,
  });
  return res.data;
};
