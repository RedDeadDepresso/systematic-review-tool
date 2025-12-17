import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PDFViewer } from './pdf-viewer';

type ReferenceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fileUrl: string;
};

export function ReferenceDialog({
  open,
  onOpenChange,
  title,
  fileUrl,
}: ReferenceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-screen h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <PDFViewer fileUrl={fileUrl} codes={[]} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
