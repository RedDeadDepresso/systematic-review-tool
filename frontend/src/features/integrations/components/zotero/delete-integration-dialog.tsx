// Confirmation dialog for removing the Zotero integration.
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  useDeleteZoteroIntegration,
  useDeletionPreview,
} from '@/features/integrations/hooks/use-zotero';
import { IconTrash, IconAlertTriangle } from '@tabler/icons-react';
import { useState } from 'react';

interface DeleteIntegrationDialogProps {
  integrationId: number;
  onSuccess?: () => void;
}

export function DeleteIntegrationDialog({
  integrationId,
  onSuccess,
}: DeleteIntegrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<'keep' | 'unlink' | 'reset'>('unlink');

  const { data: preview } = useDeletionPreview(open ? integrationId : null);
  const deleteMutation = useDeleteZoteroIntegration();

  const handleDelete = () => {
    deleteMutation.mutate(
      {
        integrationId,
        action,
        confirm: true,
      },
      {
        onSuccess: () => {
          setOpen(false);
          onSuccess?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <IconTrash className="h-4 w-4" />
          Remove Integration
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconAlertTriangle className="h-5 w-5 text-destructive" />
            Remove Zotero Integration
          </DialogTitle>
          <DialogDescription>
            Choose what to do with your synced references and PDFs.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {preview && (
            <Alert>
              <AlertDescription>
                <strong>Current state:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>
                    • {preview.synced_references} references synced to Zotero
                  </li>
                  <li>• {preview.references_with_pdfs} references have PDFs</li>
                  {preview.collection && (
                    <li>• Using collection: {preview.collection.name}</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Label>What should we do with your synced references?</Label>
            <RadioGroup value={action} onValueChange={setAction as any}>
              <div className="flex items-start space-x-3 rounded-lg border p-4">
                <RadioGroupItem value="keep" id="keep" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="keep"
                    className="font-semibold cursor-pointer"
                  >
                    Keep Everything (Safest)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Keep all Zotero keys and PDFs. You can reconnect later
                    without losing data.
                  </p>
                  {preview && (
                    <p className="text-xs text-muted-foreground mt-2">
                      • {preview.synced_references} references unchanged
                      <br />• {preview.references_with_pdfs} PDFs kept
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-lg border p-4">
                <RadioGroupItem value="unlink" id="unlink" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="unlink"
                    className="font-semibold cursor-pointer"
                  >
                    Unlink but Keep PDFs (Recommended)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Remove connection to Zotero but keep all downloaded PDFs.
                  </p>
                  {preview && (
                    <p className="text-xs text-muted-foreground mt-2">
                      • {preview.synced_references} Zotero keys removed
                      <br />• {preview.references_with_pdfs} PDFs kept
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-lg border border-destructive p-4">
                <RadioGroupItem value="reset" id="reset" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="reset"
                    className="font-semibold cursor-pointer text-destructive"
                  >
                    Reset Everything (Destructive)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Remove all Zotero data AND delete all PDFs. This cannot be
                    undone.
                  </p>
                  {preview && (
                    <p className="text-xs text-destructive mt-2">
                      ⚠️ {preview.synced_references} Zotero keys removed
                      <br />
                      ⚠️ {preview.references_with_pdfs} PDFs will be deleted
                    </p>
                  )}
                </div>
              </div>
            </RadioGroup>
          </div>

          {action === 'reset' && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-start gap-2">
                <IconAlertTriangle className="h-4 w-4 mt-0.5" />
                <div>
                  <strong>Warning:</strong> This will permanently delete{' '}
                  {preview?.references_with_pdfs || 0} PDF files. This action
                  cannot be undone.
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={deleteMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending
              ? 'Removing...'
              : action === 'reset'
                ? 'Remove & Delete PDFs'
                : 'Remove Integration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
