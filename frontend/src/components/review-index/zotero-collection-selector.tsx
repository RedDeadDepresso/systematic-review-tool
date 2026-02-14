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
  useZoteroCollections,
  useSetZoteroCollection,
  useZoteroIntegration,
  useCreateZoteroCollection,
} from '@/hooks/use-zotero';
import { IconFolders, IconFolderPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface ZoteroCollectionSelectorProps {
  integrationId: number;
}

export function ZoteroCollectionSelector({
  integrationId,
}: ZoteroCollectionSelectorProps) {
  const { data: integration } = useZoteroIntegration(integrationId);
  const { data: collections, isLoading } = useZoteroCollections(integrationId);
  const setCollection = useSetZoteroCollection(integrationId);
  const createCollection = useCreateZoteroCollection(integrationId);

  const [open, setOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [newCollectionName, setNewCollectionName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedKey === 'all') {
      setCollection.mutate(
        { collectionKey: null, collectionName: null },
        {
          onSuccess: () => {
            setOpen(false);
          },
        }
      );
    } else {
      const selectedCollection = collections?.find(
        (c) => c.key === selectedKey
      );
      setCollection.mutate(
        {
          collectionKey: selectedKey,
          collectionName: selectedCollection?.name || 'Selected Collection',
        },
        {
          onSuccess: () => {
            setOpen(false);
          },
        }
      );
    }
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();

    createCollection.mutate(
      {
        name: newCollectionName,
        setAsDefault: true,
      },
      {
        onSuccess: () => {
          setShowCreateForm(false);
          setNewCollectionName('');
          setOpen(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconFolders className="h-4 w-4" />
          <span className="hidden lg:inline">Collection</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-lg">
        {!showCreateForm ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader className="mb-4">
              <DialogTitle>Select Zotero Collection</DialogTitle>
              <DialogDescription>
                Choose which collection to sync, or sync the entire library.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              {integration?.collectionName && (
                <Alert>
                  <AlertDescription>
                    Currently syncing from:{' '}
                    <strong>{integration.collectionName}</strong>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-3">
                <Label htmlFor="collection">Collection</Label>
                <Select
                  value={selectedKey}
                  onValueChange={setSelectedKey}
                  disabled={isLoading || setCollection.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a collection..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      📚 Entire Library (All Items)
                    </SelectItem>
                    {collections?.map((collection) => (
                      <SelectItem key={collection.key} value={collection.key}>
                        📁 {collection.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {selectedKey === 'all'
                    ? 'Will sync all items from your Zotero library'
                    : selectedKey
                      ? 'Will sync only items in the selected collection'
                      : 'Choose a collection or sync entire library'}
                </p>
              </div>

              {isLoading && (
                <Alert>
                  <AlertDescription>Loading collections...</AlertDescription>
                </Alert>
              )}

              {collections && collections.length === 0 && (
                <Alert>
                  <AlertDescription>
                    No collections found in your Zotero library.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(true)}
                className="sm:mr-auto"
              >
                <IconFolderPlus className="h-4 w-4" />
                New Collection
              </Button>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!selectedKey || setCollection.isPending}
              >
                {setCollection.isPending
                  ? 'Saving...'
                  : 'Save Collection Filter'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleCreateCollection}>
            <DialogHeader className="mb-4">
              <DialogTitle>Create New Collection</DialogTitle>
              <DialogDescription>
                Create a new collection in your Zotero library.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-3">
                <Label htmlFor="collectionName">Collection Name</Label>
                <Input
                  id="collectionName"
                  placeholder="e.g., My Systematic Review 2024"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  disabled={createCollection.isPending}
                  required
                />
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  The new collection will be created in Zotero and automatically
                  set as the sync source for this review.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewCollectionName('');
                }}
                disabled={createCollection.isPending}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={!newCollectionName || createCollection.isPending}
              >
                {createCollection.isPending
                  ? 'Creating...'
                  : 'Create & Use Collection'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
