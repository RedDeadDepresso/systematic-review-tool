import React from 'react';
import { X, FileText, Upload } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState, useRef } from 'react';

interface UploadFile {
  id: string;
  name: string;
  file: File | null;
  status: 'pending' | 'uploading' | 'success' | 'error';
}

export interface FileUploadDialogProps {
  /** Modal open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Modal title */
  title?: string;
  /** Description text below the title */
  description?: string;
  /** Accepted file formats (e.g., ".pdf", ".jpg,.png", "image/*") */
  acceptedFormats?: string;
  /** MIME types to filter dropped/selected files (e.g., ["application/pdf"]) */
  fileTypeLabel?: string;
  /** Custom upload function - receives file and should return success boolean */
  onUpload: (file: File) => Promise<boolean>;
  /** Custom function to run when all file uploaded successfully */
  onAllSuccess?: () => void;
  /** Initial files to display */
  initialFiles?: { name: string }[];
  /** Icon to display in the header */
  icon?: React.ReactNode;
}

export function FileUploadDialog({
  open = true,
  onOpenChange,
  title = 'Upload Full Text PDF',
  description = 'Add PDFs to selected articles',
  acceptedFormats = '.pdf,application/pdf',
  fileTypeLabel = 'PDF',
  onUpload,
  onAllSuccess,
  initialFiles = [],
  icon,
}: FileUploadDialogProps) {
  const [files, setFiles] = useState<UploadFile[]>(() =>
    initialFiles.map((f, i) => ({
      id: `initial-${i}`,
      name: f.name,
      file: null,
      status: 'pending' as const,
    }))
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [hasAttemptedUpload, setHasAttemptedUpload] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingOrErrorFiles = files.filter(
    (f) => f.status === 'pending' || f.status === 'error'
  );
  const hasSuccessFiles = files.some((f) => f.status === 'success');
  const hasErrorFiles = files.some((f) => f.status === 'error');
  const allUploaded =
    files.length > 0 && files.every((f) => f.status === 'success');

  const handleSelectMore = () => {
    fileInputRef.current?.click();
  };

  const isAcceptedFile = (file: File) => {
    if (!acceptedFormats) return true;

    const extensions = acceptedFormats
      .split(',')
      .map((ext) => ext.trim().toLowerCase())
      .filter((ext) => ext.startsWith('.'));

    if (extensions.length === 0) return true;

    return extensions.some((ext) => file.name.toLowerCase().endsWith(ext));
  };

  const addFiles = (fileList: File[]) => {
    const newFiles: UploadFile[] = fileList
      .filter(isAcceptedFile)
      .map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        file,
        status: 'pending' as const,
      }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearUploaded = () => {
    setFiles((prev) => prev.filter((f) => f.status !== 'success'));
    setHasAttemptedUpload(false);
    setUploadProgress(0);
  };

  const handleContinue = async () => {
    const filesToUpload = files.filter(
      (f) => f.status === 'pending' || f.status === 'error'
    );
    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    setHasAttemptedUpload(true);
    setUploadProgress(0);

    let completedCount = 0;
    const totalCount = filesToUpload.length;

    // Reset error files to uploading state
    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'error' ? { ...f, status: 'uploading' as const } : f
      )
    );

    for (const fileItem of filesToUpload) {
      // Set current file to uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id ? { ...f, status: 'uploading' as const } : f
        )
      );

      let success = false;
      if (fileItem.file) {
        success = await onUpload(fileItem.file);
      }
      // Update file status based on result
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id
            ? { ...f, status: success ? 'success' : 'error' }
            : f
        )
      );

      completedCount++;
      setUploadProgress(Math.round((completedCount / totalCount) * 100));
    }

    setIsUploading(false);

    // Check if all files are now successful
    setFiles((currentFiles) => {
      const allSuccess = currentFiles.every((f) => f.status === 'success');
      if (allSuccess && onOpenChange) {
        onAllSuccess?.();
        setTimeout(() => onOpenChange(false), 500);
      }
      return currentFiles;
    });
  };

  const getBorderClass = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return 'border-green-500 bg-green-50 dark:bg-green-950/20';
      case 'error':
        return 'border-red-500 bg-red-50 dark:bg-red-950/20';
      case 'uploading':
        return 'border-blue-400 bg-blue-50 dark:bg-blue-950/20';
      default:
        return 'border-border';
    }
  };

  const headerIcon = icon ?? <FileText className="h-5 w-5" />;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={acceptedFormats}
          multiple
          className="hidden"
        />

        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-lg font-medium">
            {headerIcon}
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Subheader */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground text-sm">{description}</p>
            <button
              onClick={handleSelectMore}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors"
            >
              Select More
            </button>
          </div>

          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-4 h-[280px] flex flex-col transition-colors ${
              isDragging
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20'
                : 'border-border bg-background'
            }`}
          >
            <p className="text-muted-foreground text-sm mb-4 flex-shrink-0">
              {isDragging
                ? `Drop ${fileTypeLabel}s here...`
                : `Upload ${fileTypeLabel}s`}
            </p>

            {/* File List */}
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground text-sm gap-2">
                <Upload className="h-8 w-8 mb-2 opacity-50" />
                <p>No files selected</p>
                <p className="text-xs">
                  Drag and drop {fileTypeLabel}s here or click Select More
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="flex flex-col gap-3 pr-4">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className={`flex items-center gap-3 px-4 py-3 border rounded-lg transition-colors ${getBorderClass(file.status)}`}
                      >
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-foreground text-sm flex-1">
                          {file.name}
                        </span>
                        {file.status !== 'success' && (
                          <button
                            onClick={() => handleRemoveFile(file.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            disabled={isUploading}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Status / Progress */}
          <div className="mt-4 pt-4 border-t">
            {!hasAttemptedUpload ? (
              <p className="text-muted-foreground text-sm">
                {"Upload didn't start yet!"}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {isUploading
                      ? 'Uploading...'
                      : allUploaded
                        ? 'All files uploaded!'
                        : 'Upload complete with errors'}
                  </span>
                  <span className="text-foreground font-medium">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${hasErrorFiles && !isUploading ? 'bg-orange-500' : 'bg-blue-500'}`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleClearUploaded}
            disabled={!hasSuccessFiles || isUploading}
          >
            Clear Uploaded
          </Button>
          <Button
            onClick={handleContinue}
            disabled={isUploading || pendingOrErrorFiles.length === 0}
            variant="default"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
