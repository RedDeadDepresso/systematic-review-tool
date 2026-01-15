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
import { Textarea } from '@/components/ui/textarea';
import { useCreateMainTheme } from '@/hooks/use-main-theme';
import { useCreateSubTheme } from '@/hooks/use-sub-theme';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';

export function ThemeForm({
  reviewId,
  isMainTheme,
}: {
  reviewId: number;
  isMainTheme: boolean;
}) {
  const createTheme = isMainTheme ? useCreateMainTheme() : useCreateSubTheme();
  const themeType = isMainTheme ? 'Main' : 'Sub';
  const [form, setForm] = useState({
    name: '',
    description: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTheme.mutate({ ...form, review: reviewId });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconPlus />
          <span className="hidden lg:inline">Create {themeType} Theme</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-4">
            <DialogTitle>Create {themeType} Theme</DialogTitle>
            <DialogDescription>
              Create a theme here. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder={`${themeType} Theme Name`}
                onChange={handleChange}
                disabled={createTheme.isPending}
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder={`Describe your ${themeType} Theme!`}
                rows={8}
                onChange={handleChange}
                disabled={createTheme.isPending}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={createTheme.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
