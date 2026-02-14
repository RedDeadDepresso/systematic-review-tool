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
  useConfigureZotero,
  useFetchZoteroStatus,
  useRemoveZotero,
} from '@/hooks/use-review';
import { IconSettings, IconExternalLink, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

interface ZoteroConfigDialogProps {
  reviewId: number;
}

export function ZoteroConfigDialog({ reviewId }: ZoteroConfigDialogProps) {
  const configureZotero = useConfigureZotero(reviewId);
  const removeZotero = useRemoveZotero(reviewId);
  const { data: currentStatus } = useFetchZoteroStatus(reviewId);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    libraryId: '',
    apiKey: '',
    libraryType: 'user' as 'user' | 'group',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    configureZotero.mutate(form, {
      onSuccess: () => {
        setOpen(false);
        setForm({ libraryId: '', apiKey: '', libraryType: 'user' });
      },
    });
  };

  const handleRemove = () => {
    if (
      confirm(
        'Are you sure you want to remove Zotero configuration for this review?'
      )
    ) {
      removeZotero.mutate(undefined, {
        onSuccess: () => {
          setOpen(false);
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconSettings />
          <span className="hidden lg:inline">
            {currentStatus?.isConfigured ? 'Update' : 'Configure'} Zotero
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-4">
            <DialogTitle>Configure Zotero Integration</DialogTitle>
            <DialogDescription>
              Connect this review to Zotero to automatically fetch PDFs for your
              references.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {currentStatus?.isConfigured && (
              <Alert>
                <AlertDescription>
                  This review already has Zotero configured (
                  {currentStatus.libraryType} library). Updating will replace
                  your current credentials.
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
                disabled={configureZotero.isPending}
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
                  form.libraryType === 'user'
                    ? 'e.g., 12345678'
                    : 'e.g., 9876543'
                }
                value={form.libraryId}
                onChange={handleChange}
                disabled={configureZotero.isPending}
                required
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
                placeholder="Enter your Zotero API key"
                value={form.apiKey}
                onChange={handleChange}
                disabled={configureZotero.isPending}
                required
              />
              <p className="text-sm text-muted-foreground">
                Your API key is stored securely and never displayed.
              </p>
            </div>

            {currentStatus?.isConfigured && currentStatus.lastSync && (
              <Alert>
                <AlertDescription>
                  <strong>Last synced:</strong>{' '}
                  {new Date(currentStatus.lastSync).toLocaleString()}
                  <br />
                  <strong>Synced references:</strong>{' '}
                  {currentStatus.totalSyncedReferences}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
            <div className="flex-1">
              {currentStatus?.isConfigured && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleRemove}
                  disabled={removeZotero.isPending}
                >
                  <IconTrash className="h-4 w-4" />
                  Remove Config
                </Button>
              )}
            </div>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={
                configureZotero.isPending || !form.libraryId || !form.apiKey
              }
            >
              {configureZotero.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
