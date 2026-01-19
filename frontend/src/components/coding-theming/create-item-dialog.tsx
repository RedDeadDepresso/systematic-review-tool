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
import { useCreateCode } from '@/hooks/use-code';
import { useCreateSubTheme } from '@/hooks/use-sub-theme';
import { useCreateMainTheme } from '@/hooks/use-main-theme';
import type { MainTheme } from '@/types/main-theme';
import type { SubTheme } from '@/types/sub-theme';
import type { Code } from '@/types/code';

interface CreateItemDialogProps {
  reviewId: number;
  type: 'code' | 'subTheme' | 'mainTheme';
  onCreate: (data: Code | SubTheme | MainTheme) => void;
  children: React.ReactNode;
}

const typeLabels = {
  code: 'Code',
  subTheme: 'Sub Theme',
  mainTheme: 'Main Theme',
};

function useCreateItem(type: 'code' | 'subTheme' | 'mainTheme') {
  const code = useCreateCode();
  const subTheme = useCreateSubTheme();
  const mainTheme = useCreateMainTheme();

  switch (type) {
    case 'code':
      return code;
    case 'subTheme':
      return subTheme;
    case 'mainTheme':
      return mainTheme;
    default:
      throw new Error('Unknown type');
  }
}

export function CreateItemDialog({
  reviewId,
  type,
  onCreate,
  children,
}: CreateItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createMutation = useCreateItem(type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      const submit = (data) =>
        createMutation.mutate(data, {
          onSuccess: (data) => {
            onCreate(data);
            setName('');
            setDescription('');
            setOpen(false);
          },
        });
      if (type === 'code') {
        submit({
          review: reviewId,
          name: name.trim(),
          comment: description.trim(),
        });
      } else {
        submit({
          review: reviewId,
          name: name.trim(),
          description: description.trim(),
        });
      }
    }
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
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
