import * as React from 'react';
import { FileText, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type {
  Reference,
  ReferencePDFMapping,
} from '@/features/references/types/references';
import type { UploadedPDF } from '@/features/references/types/uploaded-pdfs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MatchPDFDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  references: Reference[];
  uploadedPDFs: UploadedPDF[];
  onImport: (payload: ReferencePDFMapping[]) => Promise<boolean>;
  onAutoMatch: () => Promise<boolean>;
}

const UNSELECTED_VALUE = '__unselected__';

export function MatchPDFDialog({
  open,
  onOpenChange,
  references,
  uploadedPDFs,
  onImport,
  onAutoMatch,
}: MatchPDFDialogProps) {
  // Map of referenceId -> uploadedPDFId (or undefined if not selected)
  const [selections, setSelections] = React.useState<
    Record<number, number | undefined>
  >({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset selections when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelections({});
    }
  }, [open]);

  // Handle selection change - if PDF is already selected elsewhere, remove that selection
  const handleSelect = (referenceId: number, value: string) => {
    if (value === UNSELECTED_VALUE) {
      // Clear selection for this reference
      setSelections((prev) => {
        const newSelections = { ...prev };
        delete newSelections[referenceId];
        return newSelections;
      });
      return;
    }

    const pdfId = parseInt(value, 10);

    setSelections((prev) => {
      const newSelections = { ...prev };

      // Find if this PDF is already selected for another reference
      const existingReferenceId = Object.entries(prev).find(
        ([, selectedPdfId]) => selectedPdfId === pdfId
      )?.[0];

      // If found, remove it from the previous reference
      if (existingReferenceId) {
        delete newSelections[parseInt(existingReferenceId, 10)];
      }

      // Set the new selection
      newSelections[referenceId] = pdfId;

      return newSelections;
    });
  };

  // Get valid mappings (only where a PDF is selected)
  const getMappings = (): ReferencePDFMapping[] => {
    return Object.entries(selections)
      .filter(([, pdfId]) => pdfId !== undefined)
      .map(([refId, pdfId]) => ({
        referenceId: parseInt(refId, 10),
        uploadedPdfId: pdfId as number,
      }));
  };

  const handleImport = async () => {
    const mappings = getMappings();
    if (mappings.length === 0) return;

    setIsSubmitting(true);
    try {
      const success = await onImport(mappings);
      if (success) onOpenChange(false);
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoMatch = async () => {
    setIsSubmitting(true);
    try {
      const success = await onAutoMatch();
      if (success) onOpenChange(false);
    } catch (error) {
      console.error('Auto match failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasSelections = getMappings().length > 0;

  // Helper to get filename from path
  const getFileName = (path: string) => {
    return path.split('/').pop() || path;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="flex flex-row items-center gap-2 pb-2">
          <FileText className="size-5 text-muted-foreground" />
          <div>
            <DialogTitle className="text-base font-medium">
              Upload Full Text PDF
            </DialogTitle>
          </div>
        </DialogHeader>

        <DialogDescription className="text-muted-foreground text-sm">
          Add PDFs to selected articles. Changing PDF assignments will delete
          any codes associated with the previous PDFs.
        </DialogDescription>

        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-sm">Match Articles to PDFs</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAutoMatch}
              className="text-primary hover:text-primary/80 gap-1.5"
            >
              <Sparkles className="size-4" />
              Auto Match
            </Button>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {references.map((reference) => (
              <div
                key={reference.id}
                className="grid grid-cols-[1fr_176px] items-center gap-3 py-2 border-b last:border-b-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="text-sm truncate"
                        aria-label={reference.title}
                      >
                        {reference.title}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{reference.title}</TooltipContent>
                  </Tooltip>
                </div>

                <Select
                  value={
                    selections[reference.id]?.toString() ?? UNSELECTED_VALUE
                  }
                  onValueChange={(value) => handleSelect(reference.id, value)}
                >
                  <SelectTrigger className="w-full border-primary/30 text-primary">
                    <SelectValue placeholder="Choose File" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSELECTED_VALUE}>
                      <span className="text-muted-foreground">Choose File</span>
                    </SelectItem>
                    {uploadedPDFs.map((pdf) => {
                      const isSelectedElsewhere = Object.entries(
                        selections
                      ).some(
                        ([refId, pdfId]) =>
                          pdfId === pdf.id &&
                          parseInt(refId, 10) !== reference.id
                      );

                      return (
                        <SelectItem
                          key={pdf.id}
                          value={pdf.id.toString()}
                          className={
                            isSelectedElsewhere ? 'text-muted-foreground' : ''
                          }
                        >
                          {getFileName(pdf.file)}
                          {isSelectedElsewhere && ' (in use)'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleImport}
            disabled={!hasSelections || isSubmitting}
            variant="default"
          >
            {isSubmitting ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
