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
import { useUploadReferenceFile } from '@/hooks/use-reference';
import { Upload } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';

export function UploadReferenceFileDialog({
  reviewId,
  referenceId,
}: {
  reviewId: number;
  referenceId: number;
}) {
  const uploadReferenceFile = useUploadReferenceFile();
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const handleUpload = () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    uploadReferenceFile.mutate({
      reviewId: reviewId,
      referenceId: referenceId,
      formData: formData,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1" size="sm">
          <Upload className="h-3 w-3" />
          Upload PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl">
        <DialogHeader className="mb-4">
          <DialogTitle>Upload Reference File</DialogTitle>
          <DialogDescription>
            Upload references. Click confirm when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3">
            <Label htmlFor="file">PDF file</Label>
            <Input
              id="file"
              name="file"
              type="file"
              onChange={handleFileChange}
              disabled={uploadReferenceFile.isPending}
              accept=".pdf"
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={uploadReferenceFile.isPending}
            onClick={handleUpload}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
