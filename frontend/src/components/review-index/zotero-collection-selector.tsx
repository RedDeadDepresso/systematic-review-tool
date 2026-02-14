// src/components/zotero/zotero-collection-selector.tsx
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
  useFetchZoteroStatus,
} from '@/hooks/use-review';
import { IconFolders } from '@tabler/icons-react';
import { useState } from 'react';
import { CreateCollectionDialog } from './create-collection-dlalog';

interface ZoteroCollectionSelectorProps {
  reviewId: number;
}

export function ZoteroCollectionSelector({
  reviewId,
}: ZoteroCollectionSelectorProps) {
  const { data: collections, isLoading } = useZoteroCollections(reviewId);
  const { data: status } = useFetchZoteroStatus(reviewId);
  const setCollection = useSetZoteroCollection(reviewId);

  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedKey === 'all') {
      // Clear collection filter
      setCollection.mutate(
        { collectionKey: null, collectionName: null },
        {
          onSuccess: () => {
            setOpen(false);
          },
        }
      );
    } else {
      // Set specific collection
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

  if (!status?.isConfigured) {
    return null;
  }

  return (
    <div className="flex gap-2">
      <CreateCollectionDialog reviewId={reviewId} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconFolders className="h-4 w-4" />
            <span className="hidden lg:inline">Select Collection</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="w-full sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader className="mb-4">
              <DialogTitle>Select Zotero Collection</DialogTitle>
              <DialogDescription>
                Choose which collection to sync, or sync the entire library.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              {status.collectionName && (
                <Alert>
                  <AlertDescription>
                    Currently syncing from:{' '}
                    <strong>{status.collectionName}</strong>
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

            <DialogFooter className="mt-6">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
