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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  const [syncAction, setSyncAction] = useState<'keep' | 'reset' | 'unlink'>(
    'unlink'
  );

  // Check if collection is changing
  const currentCollectionKey = integration?.collectionKey || 'all';
  const isCollectionChanging =
    selectedKey && selectedKey !== currentCollectionKey;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedKey === 'all') {
      setCollection.mutate(
        {
          collectionKey: null,
          collectionName: null,
          syncAction: isCollectionChanging ? syncAction : undefined,
        },
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
          syncAction: isCollectionChanging ? syncAction : undefined,
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
      <DialogContent className="w-full sm:max-w-lg max-h-[85vh] p-0 gap-0 overflow-hidden">
        <div className="flex flex-col max-h-[85vh]">
          {!showCreateForm ? (
            <>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex-shrink-0">
                <DialogHeader>
                  <DialogTitle>Select Zotero Collection</DialogTitle>
                  <DialogDescription>
                    Choose which collection to sync, or sync the entire library.
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto px-6 flex-1 min-h-0">
                <form onSubmit={handleSubmit} id="collection-form">
                  <div className="grid gap-4 pb-4">
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
                            <SelectItem
                              key={collection.key}
                              value={collection.key}
                            >
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

                    {/* Show sync action when collection is changing */}
                    {isCollectionChanging && (
                      <Alert>
                        <AlertDescription>
                          <Label className="font-semibold">
                            Collection is changing
                          </Label>
                          <p className="text-sm mt-2">
                            What should we do with existing synced references?
                          </p>
                          <RadioGroup
                            value={syncAction}
                            onValueChange={(value) =>
                              setSyncAction(
                                value as 'keep' | 'reset' | 'unlink'
                              )
                            }
                            className="mt-2 space-y-2"
                          >
                            <div className="flex items-start space-x-2">
                              <RadioGroupItem
                                value="keep"
                                id="keep-col"
                                className="mt-0.5"
                              />
                              <div className="flex-1">
                                <Label
                                  htmlFor="keep-col"
                                  className="cursor-pointer"
                                >
                                  Keep existing data
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Existing references and PDFs remain unchanged
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start space-x-2">
                              <RadioGroupItem
                                value="unlink"
                                id="unlink-col"
                                className="mt-0.5"
                              />
                              <div className="flex-1">
                                <Label
                                  htmlFor="unlink-col"
                                  className="cursor-pointer"
                                >
                                  Unlink from Zotero (keep PDFs)
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Clear Zotero keys to start fresh, keep PDFs
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start space-x-2">
                              <RadioGroupItem
                                value="reset"
                                id="reset-col"
                                className="mt-0.5"
                              />
                              <div className="flex-1">
                                <Label
                                  htmlFor="reset-col"
                                  className="cursor-pointer text-destructive"
                                >
                                  Reset all (clear PDFs and sync data)
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Remove all Zotero data and delete PDFs
                                </p>
                              </div>
                            </div>
                          </RadioGroup>
                        </AlertDescription>
                      </Alert>
                    )}

                    {isLoading && (
                      <Alert>
                        <AlertDescription>
                          Loading collections...
                        </AlertDescription>
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
                </form>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 flex-shrink-0 border-t bg-background">
                <DialogFooter className="flex-col sm:flex-row gap-2">
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
                    form="collection-form"
                    disabled={!selectedKey || setCollection.isPending}
                  >
                    {setCollection.isPending
                      ? 'Saving...'
                      : 'Save Collection Filter'}
                  </Button>
                </DialogFooter>
              </div>
            </>
          ) : (
            <>
              {/* Create Collection Form */}
              <div className="px-6 pt-6 pb-4 flex-shrink-0">
                <DialogHeader>
                  <DialogTitle>Create New Collection</DialogTitle>
                  <DialogDescription>
                    Create a new collection in your Zotero library.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="overflow-y-auto px-6 flex-1 min-h-0">
                <form
                  onSubmit={handleCreateCollection}
                  id="create-collection-form"
                >
                  <div className="grid gap-4 pb-4">
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
                        The new collection will be created in Zotero and
                        automatically set as the sync source for this review.
                      </AlertDescription>
                    </Alert>
                  </div>
                </form>
              </div>

              <div className="px-6 py-4 flex-shrink-0 border-t bg-background">
                <DialogFooter>
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
                    form="create-collection-form"
                    disabled={!newCollectionName || createCollection.isPending}
                  >
                    {createCollection.isPending
                      ? 'Creating...'
                      : 'Create & Use Collection'}
                  </Button>
                </DialogFooter>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
