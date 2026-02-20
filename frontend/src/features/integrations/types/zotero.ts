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
