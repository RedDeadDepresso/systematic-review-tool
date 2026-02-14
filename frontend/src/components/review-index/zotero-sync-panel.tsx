import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useFetchZoteroStatus,
  usePushToZotero,
  usePullFromZotero,
  useTaskStatus,
  useSyncStatus,
} from '@/hooks/use-review';
import { IconUpload, IconDownload } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { ZoteroCollectionSelector } from './zotero-collection-selector';

interface ZoteroSyncPanelProps {
  reviewId: number;
}

export function ZoteroSyncPanel({ reviewId }: ZoteroSyncPanelProps) {
  const { data: zoteroStatus } = useFetchZoteroStatus(reviewId);
  const { data: syncStatus, refetch: refetchSyncStatus } =
    useSyncStatus(reviewId);
  const pushMutation = usePushToZotero(reviewId);
  const pullMutation = usePullFromZotero(reviewId);

  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const { data: taskStatus } = useTaskStatus(currentTaskId);

  useEffect(() => {
    if (taskStatus?.status === 'SUCCESS' || taskStatus?.status === 'FAILURE') {
      // Refresh sync status when task completes
      refetchSyncStatus();
      setCurrentTaskId(null);
    }
  }, [taskStatus?.status, refetchSyncStatus]);

  const handlePush = () => {
    pushMutation.mutate(undefined, {
      onSuccess: (data) => {
        setCurrentTaskId(data.taskId);
      },
    });
  };

  const handlePull = () => {
    pullMutation.mutate(undefined, {
      onSuccess: (data) => {
        setCurrentTaskId(data.taskId);
      },
    });
  };

  if (!zoteroStatus?.isConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zotero Integration</CardTitle>
          <CardDescription>Configure Zotero to sync PDFs</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Zotero is not configured for this review. Please configure it
              first.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Zotero Sync</CardTitle>
            <CardDescription>
              Sync references and PDFs with your Zotero library
              {zoteroStatus?.collectionName && (
                <>
                  {' '}
                  from collection:{' '}
                  <strong>{zoteroStatus.collectionName}</strong>
                </>
              )}
            </CardDescription>
          </div>
          <ZoteroCollectionSelector reviewId={reviewId} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total References</p>
            <p className="text-2xl font-bold">
              {syncStatus?.totalReferences || 0}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">With PDFs</p>
            <p className="text-2xl font-bold">{syncStatus?.withPdfs || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Without PDFs</p>
            <p className="text-2xl font-bold">{syncStatus?.withoutPdfs || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Synced to Zotero</p>
            <p className="text-2xl font-bold">
              {syncStatus?.syncedToZotero || 0}
            </p>
          </div>
        </div>
        {/* Task Status */}
        {taskStatus?.status === 'SUCCESS' && (
          <Alert>
            <AlertDescription>
              ✓ {taskStatus.message}
              {taskStatus.result && (
                <>
                  <br />
                  Pushed: {taskStatus.result.pushed || 0}
                  {taskStatus.result.failed > 0 && (
                    <>
                      {' | '}
                      <span className="text-destructive">
                        Failed: {taskStatus.result.failed}
                      </span>
                    </>
                  )}
                  {taskStatus.result.errors && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        View Errors (
                        {Object.keys(taskStatus.result.errors).length})
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs">
                        {Object.entries(taskStatus.result.errors)
                          .slice(0, 10)
                          .map(([idx, error]: [string, any]) => (
                            <li key={idx} className="text-destructive">
                              Reference {idx}: {error.message}
                            </li>
                          ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {taskStatus?.status === 'SUCCESS' && taskStatus.result && (
          <Alert>
            <AlertDescription>
              ✓ Sync complete!
              <br />
              {taskStatus.result.itemsCreated > 0 && (
                <>Created: {taskStatus.result.itemsCreated}</>
              )}
              {taskStatus.result.itemsUpdated > 0 && (
                <>
                  {taskStatus.result.itemsCreated > 0 && ' | '}Updated:{' '}
                  {taskStatus.result.itemsUpdated}
                </>
              )}
              {taskStatus.result.pdfsDownloaded > 0 && (
                <> | PDFs: {taskStatus.result.pdfsDownloaded}</>
              )}
            </AlertDescription>
          </Alert>
        )}

        {taskStatus?.status === 'SUCCESS' && taskStatus.result && (
          <Alert>
            <AlertDescription>
              ✓ Sync complete!
              <br />
              Pushed: {taskStatus.result.pushed || 0}
              {taskStatus.result.failed > 0 && (
                <>
                  {' | '}
                  <span className="text-destructive">
                    Failed: {taskStatus.result.failed}
                  </span>
                </>
              )}
              {taskStatus.result.collection_name && (
                <> | Collection: {taskStatus.result.collectionName}</>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Sync Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handlePush}
            disabled={pushMutation.isPending || !!currentTaskId}
            className="flex-1"
          >
            <IconUpload className="h-4 w-4" />
            Push to Zotero
          </Button>
          <Button
            onClick={handlePull}
            disabled={pullMutation.isPending || !!currentTaskId}
            className="flex-1"
          >
            <IconDownload className="h-4 w-4" />
            Pull from Zotero
          </Button>
        </div>
        <Alert>
          <AlertDescription className="text-sm">
            <strong>How it works:</strong>
            <ol className="mt-2 ml-4 list-decimal space-y-1">
              <li>
                <strong>Push to Zotero:</strong> Send references without PDFs to
                your Zotero library
              </li>
              <li>
                <strong>In Zotero:</strong> Select items → Right-click → "Find
                Available PDFs"
              </li>
              <li>
                <strong>Pull from Zotero:</strong> Download PDFs back to your
                review
              </li>
            </ol>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
