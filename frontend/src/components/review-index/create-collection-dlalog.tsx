// src/components/zotero/create-collection-dialog.tsx
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
import { Switch } from '@/components/ui/switch';
import { useCreateZoteroCollection } from '@/hooks/use-zotero';
import { IconFolderPlus } from '@tabler/icons-react';
import { useState } from 'react';

interface CreateCollectionDialogProps {
  reviewId: number;
}

export function CreateCollectionDialog({
  reviewId,
}: CreateCollectionDialogProps) {
  const createCollection = useCreateZoteroCollection(reviewId);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCollection.mutate(
      {
        name,
        setAsDefault,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setName('');
          setSetAsDefault(true);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconFolderPlus className="h-4 w-4" />
          <span className="hidden lg:inline">Create Collection</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-4">
            <DialogTitle>Create Zotero Collection</DialogTitle>
            <DialogDescription>
              Create a new collection in your Zotero library for this review.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-3">
              <Label htmlFor="name">Collection Name</Label>
              <Input
                id="name"
                placeholder="e.g., My Systematic Review 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={createCollection.isPending}
                required
              />
            </div>

            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="set-default">Use for this review</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically sync from this collection
                </p>
              </div>
              <Switch
                id="set-default"
                checked={setAsDefault}
                onCheckedChange={setSetAsDefault}
                disabled={createCollection.isPending}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={!name || createCollection.isPending}
            >
              {createCollection.isPending ? 'Creating...' : 'Create Collection'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
