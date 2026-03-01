import { FileText, Trash2, SaveOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useDeleteUploadedPDF,
  useFetchUploadedPDFs,
} from '@/features/references/hooks/use-uploaded-pdfs';
import { Button } from '@/components/ui/button';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';

export interface FileUploadDialogProps {
  reviewId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SavedPDFDialog({
  reviewId,
  open,
  onOpenChange,
}: FileUploadDialogProps) {
  const headerIcon = <FileText className="h-5 w-5" />;
  const title = ' View and manage uploaded PDF';
  const { data: files = [] } = useFetchUploadedPDFs(reviewId);
  const deleteUploadedPDF = useDeleteUploadedPDF();
  const [search, setSearch] = useState('');
  const filteredFiles = useMemo(() => {
    return files.filter((file) =>
      file.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [files, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-lg font-medium">
            {headerIcon}
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="w-full min-w-0 px-6 py-4">
          <div className="flex items-center justify-between mb-4 gap-4">
            <Input
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="border-2 rounded-lg h-[280px] flex flex-col transition-colors border-border bg-background overflow-hidden">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground text-sm gap-2">
                <SaveOff className="h-8 w-8 mb-2 opacity-50" />
                <p>No files uploaded</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-3">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 px-4 py-3 border rounded-lg min-w-0"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground text-sm flex-1 truncate min-w-0">
                        {file.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          deleteUploadedPDF.mutate({ id: file.id, reviewId })
                        }
                        className="text-muted-foreground hover:text-destructive-foreground flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
