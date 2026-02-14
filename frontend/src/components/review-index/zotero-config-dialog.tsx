import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useZoteroIntegration,
  useCreateZoteroIntegration,
  useUpdateZoteroIntegration,
  useDeleteZoteroIntegration,
} from '@/hooks/use-zotero';
import { IconSettings, IconExternalLink, IconTrash } from '@tabler/icons-react';
import { useState, useEffect } from 'react';

interface ZoteroConfigDialogProps {
  reviewId: number;
}

export function ZoteroConfigDialog({ reviewId }: ZoteroConfigDialogProps) {
  const { data: integration, isLoading: loadingIntegration } =
    useZoteroIntegration(reviewId);
  const createIntegration = useCreateZoteroIntegration();
  const updateIntegration = useUpdateZoteroIntegration(integration?.id || 0);
  const deleteIntegration = useDeleteZoteroIntegration();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    libraryId: '',
    apiKey: '',
    libraryType: 'user' as 'user' | 'group',
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm({
        libraryId: '',
        apiKey: '',
        libraryType: integration?.libraryType || 'user',
      });
    }
  }, [open, integration]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (integration) {
      // Update existing integration
      updateIntegration.mutate(
        {
          libraryId: form.libraryId || undefined,
          apiKey: form.apiKey || undefined,
          libraryType: form.libraryType,
        },
        {
          onSuccess: () => {
            setOpen(false);
          },
        }
      );
    } else {
      // Create new integration
      createIntegration.mutate(
        {
          review: reviewId,
          libraryId: form.libraryId,
          apiKey: form.apiKey,
          libraryType: form.libraryType,
        },
        {
          onSuccess: () => {
            setOpen(false);
          },
        }
      );
    }
  };

  const handleRemove = () => {
    if (!integration) return;

    if (
      confirm(
        'Are you sure you want to remove Zotero integration for this review?'
      )
    ) {
      deleteIntegration.mutate(integration.id, {
        onSuccess: () => {
          setOpen(false);
        },
      });
    }
  };

  const isSubmitting =
    createIntegration.isPending || updateIntegration.isPending;
  const isDeleting = deleteIntegration.isPending;

  if (loadingIntegration) {
    return (
      <Button variant="outline" size="sm" disabled>
        <IconSettings className="h-4 w-4" />
        <span className="hidden lg:inline">Loading...</span>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconSettings className="h-4 w-4" />
          <span className="hidden lg:inline">
            {integration?.isConfigured ? 'Update' : 'Configure'} Zotero
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-4">
            <DialogTitle>
              {integration ? 'Update' : 'Configure'} Zotero Integration
            </DialogTitle>
            <DialogDescription>
              Connect this review to Zotero to automatically fetch PDFs for your
              references.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {integration?.isConfigured && (
              <Alert>
                <AlertDescription>
                  This review is already connected to a Zotero{' '}
                  {integration.libraryType} library.
                  {form.apiKey || form.libraryId
                    ? ' Updating will replace your current credentials.'
                    : ' Leave fields empty to keep current credentials.'}
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertDescription className="text-sm">
                <strong>How to get your credentials:</strong>
                <ol className="mt-2 ml-4 list-decimal space-y-1">
                  <li>
                    Go to{' '}
                    <a
                      href="https://www.zotero.org/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      Zotero API Settings
                      <IconExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>Your User ID is shown at the top of the page</li>
                  <li>Click "Create new private key" to generate an API key</li>
                  <li>Give it a name and enable "Allow library access"</li>
                  <li>Copy the generated API key (you won't see it again!)</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="grid gap-3">
              <Label htmlFor="libraryType">Library Type</Label>
              <Select
                value={form.libraryType}
                onValueChange={(value: 'user' | 'group') =>
                  setForm({ ...form, libraryType: value })
                }
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    Personal Library (recommended for solo work)
                  </SelectItem>
                  <SelectItem value="group">
                    Group Library (for team collaboration)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {form.libraryType === 'user'
                  ? 'Use your personal Zotero library. Best for individual research.'
                  : 'Use a shared Zotero group library. Best for team projects.'}
              </p>
            </div>

            <div className="grid gap-3">
              <Label htmlFor="libraryId">
                {form.libraryType === 'user' ? 'User ID' : 'Group ID'}
              </Label>
              <Input
                id="libraryId"
                name="libraryId"
                placeholder={
                  integration
                    ? 'Leave empty to keep current'
                    : form.libraryType === 'user'
                      ? 'e.g., 12345678'
                      : 'e.g., 9876543'
                }
                value={form.libraryId}
                onChange={handleChange}
                disabled={isSubmitting}
                required={!integration}
              />
              <p className="text-sm text-muted-foreground">
                {form.libraryType === 'user'
                  ? 'Found at https://www.zotero.org/settings/keys'
                  : 'Found in your group URL: zotero.org/groups/[GROUP_ID]/...'}
              </p>
            </div>

            <div className="grid gap-3">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                name="apiKey"
                type="password"
                placeholder={
                  integration
                    ? 'Leave empty to keep current key'
                    : 'Enter your Zotero API key'
                }
                value={form.apiKey}
                onChange={handleChange}
                disabled={isSubmitting}
                required={!integration}
              />
              <p className="text-sm text-muted-foreground">
                Your API key is stored securely and never displayed.
              </p>
            </div>

            {integration && (
              <Alert>
                <AlertDescription>
                  <strong>Current configuration:</strong>
                  <br />
                  Library Type: {integration.libraryType}
                  <br />
                  {integration.lastPushAt && (
                    <>
                      Last Push:{' '}
                      {new Date(integration.lastPushAt).toLocaleString()}
                      <br />
                    </>
                  )}
                  {integration.lastPullAt && (
                    <>
                      Last Pull:{' '}
                      {new Date(integration.lastPullAt).toLocaleString()}
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
            <div className="flex-1">
              {integration && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleRemove}
                  disabled={isDeleting || isSubmitting}
                >
                  <IconTrash className="h-4 w-4" />
                  {isDeleting ? 'Removing...' : 'Remove Integration'}
                </Button>
              )}
            </div>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSubmitting || isDeleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                isDeleting ||
                (!integration && (!form.libraryId || !form.apiKey))
              }
            >
              {isSubmitting
                ? 'Saving...'
                : integration
                  ? 'Update Integration'
                  : 'Configure Integration'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
