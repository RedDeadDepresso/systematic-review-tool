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
import { Progress } from '@/components/ui/progress';
import {
  useZoteroIntegration,
  useZoteroStatus,
  usePushToZotero,
  usePullFromZotero,
} from '@/features/integrations/hooks/use-zotero';
import { useTaskWebSocket } from '@/features/integrations/hooks/use-task-websocket';
import {
  IconUpload,
  IconDownload,
  IconRefresh,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { ZoteroCollectionSelector } from '@/features/integrations/components/zotero/zotero-collection-selector';
import { ChevronDownIcon } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

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

  // Use WebSocket for real-time task status
  // Update the WebSocket badge section
  const {
    status: taskStatus,
    isConnected,
    isCompleted,
  } = useTaskWebSocket(currentTaskId, {
    onSuccess: (result) => {
      console.log('Task completed:', result);
      // Auto-clear task ID after showing result for 3 seconds
      setTimeout(() => {
        setCurrentTaskId(null);
      }, 3000);

      // Refresh status
      refetchStatus();
    },
    onError: (error) => {
      console.error('Task error:', error);
      // Auto-clear task ID after showing error for 5 seconds
      setTimeout(() => {
        setCurrentTaskId(null);
      }, 5000);
    },
    onProgress: (progressStatus) => {
      console.log('Progress update:', progressStatus);
    },
  });

  const handlePush = async () => {
    if (!integration) return;

    try {
      const result = await pushMutation.mutateAsync(false);

      // Check if warning (needs confirmation)
      if (result.warning) {
        if (
          confirm(
            `${result.warning}\n\n` +
              `This will take approximately ${result.estimatedTimeMinutes} minutes.\n\n` +
              `Continue?`
          )
        ) {
          // User confirmed, retry with confirmation
          const confirmedResult = await pushMutation.mutateAsync(true);
          setCurrentTaskId(confirmedResult.taskId);
        }
      } else {
        // No warning, proceed
        setCurrentTaskId(result.taskId);
      }
    } catch (error) {
      // Error already handled by mutation
    }
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
      <Collapsible>
        <Card className="py-0">
          <CollapsibleTrigger asChild>
            <div className="group flex w-full items-center py-2 justify-between hover:bg-accent/50 transition-colors rounded-t-lg">
              <CardHeader className="w-full">
                <div className="flex items-center justify-between">
                  <div className="text-start">
                    <CardTitle>Zotero Sync</CardTitle>
                    <CardDescription>
                      Sync references and PDFs with your Zotero library
                    </CardDescription>
                  </div>
                  <div className="flex gap-4 items-center">
                    <ChevronDownIcon className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
                  </div>
                </div>
              </CardHeader>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 px-6 pb-6 text-sm text-muted-foreground">
              Zotero is not configured for this review. Please configure it
              first.
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  const isSyncing =
    !!currentTaskId &&
    taskStatus?.status !== 'SUCCESS' &&
    taskStatus?.status !== 'FAILURE';
  const unpushedCount =
    (status?.totalReferences || 0) - (status?.syncedReferences || 0);

  // Calculate progress percentage
  const progressPercentage = taskStatus?.total
    ? Math.round(((taskStatus.progress || 0) / taskStatus.total) * 100)
    : 0;

  return (
    <Collapsible>
      <Card className="py-0">
        <CollapsibleTrigger asChild>
          <div className="group flex w-full items-center py-2 justify-between hover:bg-accent/50 transition-colors rounded-t-lg">
            <CardHeader className="w-full">
              <div className="flex items-center justify-between">
                <div className="text-start">
                  <CardTitle>Zotero Sync</CardTitle>
                  <CardDescription>
                    Sync references and PDFs with your Zotero library
                    {status?.collectionName && (
                      <>
                        {' '}
                        from collection:{' '}
                        <strong>{status.collectionName}</strong>
                      </>
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-4 items-center">
                  {integration.id && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <ZoteroCollectionSelector
                        integrationId={integration.id}
                      />
                    </div>
                  )}
                  <ChevronDownIcon className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
                </div>
              </div>
            </CardHeader>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 px-6 pb-6">
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

              {/* WebSocket Connection Indicator - only show when task is active and not completed */}
              {currentTaskId && !isCompleted && (
                <Badge
                  variant={isConnected ? 'default' : 'secondary'}
                  className="gap-1"
                >
                  <div
                    className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
                  />
                  {isConnected ? 'Live Updates' : 'Connecting...'}
                </Badge>
              )}
            </div>

            {/* Sync Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Total References
                </p>
                <p className="text-2xl font-bold">
                  {status?.totalReferences || 0}
                </p>
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
                <p className="text-sm text-muted-foreground">
                  Synced to Zotero
                </p>
                <p className="text-2xl font-bold">
                  {status?.syncedReferences || 0}
                </p>
              </div>
            </div>

            {/* Task Progress - Real-time via WebSocket */}
            {taskStatus && taskStatus.status === 'PROGRESS' && (
              <div className="space-y-3">
                <Alert>
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{taskStatus.message}</span>
                        <span className="font-medium">
                          {taskStatus.progress || 0} / {taskStatus.total || 0}
                        </span>
                      </div>
                      <Progress value={progressPercentage} className="h-2" />

                      {/* Show batch progress if available */}
                      {taskStatus.batch_number && taskStatus.total_batches && (
                        <p className="text-xs text-muted-foreground">
                          Batch {taskStatus.batch_number} of{' '}
                          {taskStatus.total_batches}
                        </p>
                      )}

                      {/* Show interim counts */}
                      {(taskStatus.pushed ||
                        taskStatus.created ||
                        taskStatus.pdfs) && (
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {taskStatus.pushed !== undefined && (
                            <span>Pushed: {taskStatus.pushed}</span>
                          )}
                          {taskStatus.created !== undefined && (
                            <span>Created: {taskStatus.created}</span>
                          )}
                          {taskStatus.updated !== undefined && (
                            <span>Updated: {taskStatus.updated}</span>
                          )}
                          {taskStatus.pdfs !== undefined && (
                            <span>PDFs: {taskStatus.pdfs}</span>
                          )}
                          {taskStatus.failed !== undefined &&
                            taskStatus.failed > 0 && (
                              <span className="text-destructive">
                                Failed: {taskStatus.failed}
                              </span>
                            )}
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Task Status - Pending/Started */}
            {taskStatus &&
              ['PENDING', 'STARTED'].includes(taskStatus.status) && (
                <Alert>
                  <AlertDescription className="flex items-center gap-2">
                    <IconRefresh className="h-4 w-4 animate-spin" />
                    {taskStatus.message}
                  </AlertDescription>
                </Alert>
              )}

            {/* Task Success */}
            {taskStatus?.status === 'SUCCESS' && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">✓ {taskStatus.message}</p>
                    {taskStatus.result && (
                      <div className="text-sm space-y-1">
                        {taskStatus.result.items_created > 0 && (
                          <p>Created: {taskStatus.result.items_created}</p>
                        )}
                        {taskStatus.result.items_updated > 0 && (
                          <p>Updated: {taskStatus.result.items_updated}</p>
                        )}
                        {taskStatus.result.pushed > 0 && (
                          <p>Pushed: {taskStatus.result.pushed}</p>
                        )}
                        {taskStatus.result.failed > 0 && (
                          <p className="text-destructive">
                            Failed: {taskStatus.result.failed}
                          </p>
                        )}
                        {taskStatus.result.pdfs_downloaded > 0 && (
                          <p>
                            PDFs Downloaded: {taskStatus.result.pdfs_downloaded}
                          </p>
                        )}
                        {taskStatus.result.batches_processed > 1 && (
                          <p className="text-muted-foreground">
                            Processed in {taskStatus.result.batches_processed}{' '}
                            batches
                            {taskStatus.result.total_time_seconds &&
                              ` (${taskStatus.result.total_time_seconds}s)`}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Show errors if any */}
                    {taskStatus.result?.errors &&
                      taskStatus.result.errors.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-medium">
                            View Errors ({taskStatus.result.errors.length})
                          </summary>
                          <ul className="mt-2 space-y-1 text-xs">
                            {taskStatus.result.errors
                              .slice(0, 10)
                              .map((error: string, idx: number) => (
                                <li key={idx} className="text-destructive">
                                  {error}
                                </li>
                              ))}
                            {taskStatus.result.errors.length > 10 && (
                              <li className="text-muted-foreground">
                                ... and {taskStatus.result.errors.length - 10}{' '}
                                more
                              </li>
                            )}
                          </ul>
                        </details>
                      )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Task Failure */}
            {taskStatus?.status === 'FAILURE' && (
              <Alert variant="destructive">
                <AlertDescription>
                  <p className="font-medium">✗ Sync failed</p>
                  <p className="text-sm mt-1">
                    {taskStatus.error || 'Unknown error'}
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Sync Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handlePush}
                disabled={isSyncing || unpushedCount === 0}
                className="flex-1"
              >
                <IconUpload className="h-4 w-4" />
                Push to Zotero
                {unpushedCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
                    {unpushedCount}
                  </span>
                )}
              </Button>
              <Button
                onClick={handlePull}
                disabled={isSyncing}
                className="flex-1"
              >
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

            {/* No unpushed references message */}
            {unpushedCount === 0 && !isSyncing && (
              <Alert>
                <AlertDescription>
                  All references are synced to Zotero. No references to push.
                </AlertDescription>
              </Alert>
            )}

            {/* Instructions */}
            <div className="rounded-lg border bg-card">
              <details className="group">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors rounded-lg">
                    <span className="text-sm font-medium">
                      📖 How to use Zotero Integration
                    </span>
                    <ChevronDownIcon className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </div>
                </summary>

                <div className="px-4 pb-4 pt-2 space-y-3 text-sm border-t">
                  <div>
                    <strong className="text-base">
                      Recommended Workflows:
                    </strong>
                  </div>

                  {/* Strategy 1 */}
                  <div>
                    <strong className="text-sm">
                      Strategy 1: Start in This App (Recommended)
                    </strong>
                    <ol className="mt-2 ml-4 list-decimal space-y-1.5">
                      <li>
                        <strong>Create a Collection:</strong> Click "Collection"
                        above to create a dedicated Zotero collection for this
                        review (e.g., "My Review - Full Text")
                      </li>
                      <li>
                        <strong>Push to Zotero:</strong> Send all references
                        from full text screening without PDFs to your Zotero
                        collection
                      </li>
                      <li>
                        <strong>In Zotero:</strong> Select all items in your
                        collection → Right-click → "Find Available PDFs"
                      </li>
                      <li>
                        <strong>Pull from Zotero:</strong> Download PDFs back to
                        your review
                      </li>
                    </ol>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      💡 <strong>Tip:</strong> Using a collection keeps your
                      references organised and prevents mixing with other Zotero
                      items.
                    </p>
                  </div>

                  {/* Strategy 2 */}
                  <div className="border-t pt-3">
                    <strong>Strategy 2: Start in Zotero</strong>
                    <ol className="mt-2 ml-4 list-decimal space-y-1.5">
                      <li>
                        <strong>Import to Zotero:</strong> Add your references
                        directly to a Zotero collection using plugins (e.g.,
                        browser connector, DOI lookup)
                      </li>
                      <li>
                        <strong>Select Collection:</strong> Click "Collection"
                        above and choose your existing Zotero collection
                      </li>
                      <li>
                        <strong>Pull from Zotero:</strong> Import all references
                        and PDFs into this review
                      </li>
                      <li>
                        <strong>For Next Stage:</strong> When moving to full
                        text screening:
                        <ul className="mt-1 ml-4 list-disc space-y-1">
                          <li>
                            Create a new collection in Zotero (e.g., "My Review
                            - Full Text")
                          </li>
                          <li>
                            Switch to the new collection here and click "Unlink
                            but Keep PDFs" to reset
                          </li>
                          <li>
                            Push references that need full text to the new
                            collection
                          </li>
                          <li>Repeat steps 3-4 from Strategy 1</li>
                        </ul>
                      </li>
                    </ol>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      💡 <strong>Tip:</strong> This workflow is ideal if you
                      already have references in Zotero with PDFs attached.
                    </p>
                  </div>

                  {/* Best Practices */}
                  <div className="border-t pt-3">
                    <strong className="text-sm">Best Practices:</strong>
                    <ul className="mt-2 ml-4 list-disc space-y-1">
                      <li>
                        <strong>Always use collections</strong> to keep review
                        stages separate (e.g., "Screening", "Full Text",
                        "Included")
                      </li>
                      <li>
                        <strong>Use "Unlink but Keep PDFs"</strong> when
                        changing collections to preserve your downloaded PDFs
                      </li>
                      <li>
                        <strong>Push only what you need</strong> - pushing fewer
                        references is faster and keeps Zotero organised
                      </li>
                    </ul>
                  </div>
                </div>
              </details>
            </div>

            {/* Last Sync Info */}
            {(status?.lastPush || status?.lastPull) && (
              <div className="text-sm text-muted-foreground space-y-1">
                {status.lastPush && (
                  <p>
                    Last pushed: {new Date(status.lastPush).toLocaleString()}
                  </p>
                )}
                {status.lastPull && (
                  <p>
                    Last pulled: {new Date(status.lastPull).toLocaleString()}
                  </p>
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
                          {sync.sync_type}
                        </span>
                        <Badge
                          variant={sync.success ? 'default' : 'destructive'}
                        >
                          {sync.success ? 'Success' : 'Failed'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sync.synced_at).toLocaleString()}
                      </p>
                      {sync.items_processed > 0 && (
                        <p className="text-xs">
                          Processed: {sync.items_processed}
                          {sync.items_with_pdfs > 0 &&
                            ` | PDFs: ${sync.items_with_pdfs}`}
                        </p>
                      )}
                      {sync.error_message && (
                        <p className="text-xs text-destructive">
                          {sync.error_message}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
