import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  useZoteroIntegration,
  useZoteroStatus,
  usePushToZotero,
  usePullFromZotero,
  useTaskStatus,
} from '@/hooks/use-zotero';
import {
  IconUpload,
  IconDownload,
  IconRefresh,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { ZoteroCollectionSelector } from './zotero-collection-selector';

interface ZoteroSyncPanelProps {
  reviewId: number;
}

export function ZoteroSyncPanel({ reviewId }: ZoteroSyncPanelProps) {
  const { data: integration, isLoading: loadingIntegration } =
    useZoteroIntegration(reviewId);
  const { data: status, refetch: refetchStatus } = useZoteroStatus(
    integration?.id
  );

  const pushMutation = usePushToZotero(integration?.id || 0);
  const pullMutation = usePullFromZotero(integration?.id || 0);

  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const { data: taskStatus } = useTaskStatus(currentTaskId);

  // Clear task ID when task completes
  useEffect(() => {
    if (taskStatus?.status === 'SUCCESS' || taskStatus?.status === 'FAILURE') {
      setTimeout(() => {
        setCurrentTaskId(null);
        refetchStatus();
      }, 3000); // Clear after 3 seconds to show result
    }
  }, [taskStatus?.status, refetchStatus]);

  const handlePush = () => {
    if (!integration) return;

    pushMutation.mutate(undefined, {
      onSuccess: (data) => {
        setCurrentTaskId(data.taskId);
      },
    });
  };

  const handlePull = () => {
    if (!integration) return;

    pullMutation.mutate(false, {
      onSuccess: (data) => {
        setCurrentTaskId(data.taskId);
      },
    });
  };

  const handleForcePull = () => {
    if (!integration) return;

    if (confirm('Force sync will re-download all items. Continue?')) {
      pullMutation.mutate(true, {
        onSuccess: (data) => {
          setCurrentTaskId(data.taskId);
        },
      });
    }
  };

  if (loadingIntegration) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zotero Integration</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!integration?.isConfigured) {
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

  const isSyncing =
    !!currentTaskId &&
    taskStatus?.status !== 'SUCCESS' &&
    taskStatus?.status !== 'FAILURE';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle>Zotero Sync</CardTitle>
            <CardDescription>
              Sync references and PDFs with your Zotero library
              {status?.collectionName && (
                <>
                  {' '}
                  from collection: <strong>{status.collectionName}</strong>
                </>
              )}
            </CardDescription>
          </div>
          {integration.id && (
            <ZoteroCollectionSelector integrationId={integration.id} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          {integration.isActive ? (
            <Badge variant="default" className="gap-1">
              <IconCheck className="h-3 w-3" />
              Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <IconX className="h-3 w-3" />
              Inactive
            </Badge>
          )}
        </div>

        {/* Sync Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total References</p>
            <p className="text-2xl font-bold">{status?.totalReferences || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">With PDFs</p>
            <p className="text-2xl font-bold">
              {status?.referencesWithPdfs || 0}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Without PDFs</p>
            <p className="text-2xl font-bold">
              {(status?.totalReferences || 0) -
                (status?.referencesWithPdfs || 0)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Synced to Zotero</p>
            <p className="text-2xl font-bold">
              {status?.syncedReferences || 0}
            </p>
          </div>
        </div>

        {/* Task Status */}
        {taskStatus &&
          taskStatus.status !== 'SUCCESS' &&
          taskStatus.status !== 'FAILURE' && (
            <Alert>
              <AlertDescription className="flex items-center gap-2">
                <IconRefresh className="h-4 w-4 animate-spin" />
                {taskStatus.message}
              </AlertDescription>
            </Alert>
          )}

        {taskStatus?.status === 'SUCCESS' && (
          <Alert>
            <AlertDescription>
              ✓ {taskStatus.message}
              {taskStatus.result && (
                <>
                  <br />
                  {taskStatus.result.itemsCreated > 0 && (
                    <>Created: {taskStatus.result.itemsCreated}</>
                  )}
                  {taskStatus.result.items_updated > 0 && (
                    <>
                      {taskStatus.result.itemsCreated > 0 && ' | '}
                      Updated: {taskStatus.result.itemsCreated}
                    </>
                  )}
                  {taskStatus.result.pushed > 0 && (
                    <>Pushed: {taskStatus.result.pushed}</>
                  )}
                  {taskStatus.result.failed > 0 && (
                    <>
                      {' | '}
                      <span className="text-destructive">
                        Failed: {taskStatus.result.failed}
                      </span>
                    </>
                  )}
                  {taskStatus.result.pdfsDownloaded > 0 && (
                    <> | PDFs: {taskStatus.result.pdfsDownloaded}</>
                  )}
                  {taskStatus.result.errors &&
                    taskStatus.result.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-medium">
                          View Errors ({taskStatus.result.errors.length})
                        </summary>
                        <ul className="mt-2 space-y-1 text-xs">
                          {taskStatus.result.errors
                            .slice(0, 5)
                            .map((error: string, idx: number) => (
                              <li key={idx} className="text-destructive">
                                {error}
                              </li>
                            ))}
                          {taskStatus.result.errors.length > 5 && (
                            <li className="text-muted-foreground">
                              ... and {taskStatus.result.errors.length - 5} more
                            </li>
                          )}
                        </ul>
                      </details>
                    )}
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {taskStatus?.status === 'FAILURE' && (
          <Alert variant="destructive">
            <AlertDescription>
              ✗ Sync failed: {taskStatus.error}
            </AlertDescription>
          </Alert>
        )}

        {/* Sync Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handlePush} disabled={isSyncing} className="flex-1">
            <IconUpload className="h-4 w-4" />
            Push to Zotero
          </Button>
          <Button onClick={handlePull} disabled={isSyncing} className="flex-1">
            <IconDownload className="h-4 w-4" />
            Pull from Zotero
          </Button>
          <Button
            variant="outline"
            onClick={handleForcePull}
            disabled={isSyncing}
          >
            <IconRefresh className="h-4 w-4" />
            Force Sync
          </Button>
        </div>

        {/* Instructions */}
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

        {/* Last Sync Info */}
        {(status?.lastPush || status?.lastPull) && (
          <div className="text-sm text-muted-foreground space-y-1">
            {status.lastPush && (
              <p>Last pushed: {new Date(status.lastPush).toLocaleString()}</p>
            )}
            {status.lastPull && (
              <p>Last pulled: {new Date(status.lastPull).toLocaleString()}</p>
            )}
          </div>
        )}

        {/* Recent Syncs */}
        {status?.recentSyncs && status.recentSyncs.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">
              Recent Sync History ({status.recentSyncs.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {status.recentSyncs.slice(0, 5).map((sync: any) => (
                <li key={sync.id} className="border-l-2 pl-2 border-muted">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">
                      {sync.syncType}
                    </span>
                    <Badge variant={sync.success ? 'default' : 'destructive'}>
                      {sync.success ? 'Success' : 'Failed'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sync.syncedAt).toLocaleString()}
                  </p>
                  {sync.itemsProcessed > 0 && (
                    <p className="text-xs">
                      Processed: {sync.itemsProcessed}
                      {sync.itemsWithPdfs > 0 &&
                        ` | PDFs: ${sync.itemsWithPdfs}`}
                    </p>
                  )}
                  {sync.errorMessage && (
                    <p className="text-xs text-destructive">
                      {sync.errorMessage}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
