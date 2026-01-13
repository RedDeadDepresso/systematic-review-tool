import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PDFViewer } from './pdf-viewer';
import { useFetchCodes } from '@/hooks/use-code';
import { Spinner } from '../ui/spinner';

type ReferenceDialogProps = {
  referenceId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fileUrl: string;
};

export function ReferenceDialog({
  referenceId,
  open,
  onOpenChange,
  title,
  fileUrl,
}: ReferenceDialogProps) {
  const { data, isLoading } = useFetchCodes({ referenceId });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-screen h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="flex h-96 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <PDFViewer referenceId={referenceId} fileUrl={fileUrl} codes={data} />
        )}
      </DialogContent>
    </Dialog>
  );
}
