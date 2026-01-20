import type React from 'react';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CreateItemDialogProps {
  type: 'code' | 'subTheme' | 'mainTheme';
  onCreate: (name: string, description: string) => Promise<boolean>;
  children: React.ReactNode;
}

const typeLabels = {
  code: 'Code',
  subTheme: 'Sub Theme',
  mainTheme: 'Main Theme',
};

export function CreateItemDialog({
  type,
  onCreate,
  children,
}: CreateItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setIsPending(true);
    if (await onCreate(trimmedName, description.trim())) {
      setName('');
      setDescription('');
    }
    setIsPending(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create {typeLabels[type]}</DialogTitle>
            <DialogDescription>
              Add a new {typeLabels[type].toLowerCase()} to your analysis.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Enter ${typeLabels[type].toLowerCase()} name`}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">
                {type === 'code' ? 'Comment' : 'Description'}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  type === 'code' ? 'Add a comment' : 'Add a description'
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name?.trim() || isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
