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
import { useCreateTheme } from '@/hooks/use-theme';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';

export function ThemeForm({ reviewId }: { reviewId: number }) {
  const theme = useCreateTheme();
  const [form, setForm] = useState({
    review: reviewId,
    name: '',
    description: '',
    codes: [],
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    theme.mutate({
      review: reviewId,
      data: {
        review: reviewId,
        name: form.name,
        description: form.description,
        codes: [],
      },
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconPlus />
          <span className="hidden lg:inline">Create Theme</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-4">
            <DialogTitle>Create Theme</DialogTitle>
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
                placeholder="Theme name"
                onChange={handleChange}
                disabled={theme.isPending}
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe your theme!"
                rows={8}
                onChange={handleChange}
                disabled={theme.isPending}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={theme.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
