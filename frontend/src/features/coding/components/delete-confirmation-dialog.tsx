'use client';

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'code' | 'subTheme' | 'mainTheme';
  itemName: string;
  onConfirm: (options?: {
    deleteCodes?: boolean;
    deleteSubThemes?: boolean;
  }) => void;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  type,
  itemName,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  const [deleteCodes, setDeleteCodes] = useState(false);
  const [deleteSubThemes, setDeleteSubThemes] = useState(false);

  // Reset checkboxes when dialog closes
  useEffect(() => {
    if (!open) {
      setDeleteCodes(false);
      setDeleteSubThemes(false);
    }
  }, [open]);

  // When deleteSubThemes is unchecked, also uncheck deleteCodes
  useEffect(() => {
    if (!deleteSubThemes) {
      setDeleteCodes(false);
    }
  }, [deleteSubThemes]);

  const handleConfirm = () => {
    if (type === 'code') {
      onConfirm();
    } else if (type === 'subTheme') {
      onConfirm({ deleteCodes });
    } else {
      onConfirm({ deleteSubThemes, deleteCodes });
    }
    onOpenChange(false);
  };

  const getTitle = () => {
    switch (type) {
      case 'code':
        return 'Delete Code';
      case 'subTheme':
        return 'Delete Sub Theme';
      case 'mainTheme':
        return 'Delete Main Theme';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'code':
        return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
      case 'subTheme':
        return `Are you sure you want to delete "${itemName}"? By default, codes inside will be moved back to the codes pool.`;
      case 'mainTheme':
        return `Are you sure you want to delete "${itemName}"? By default, sub themes inside will be moved back to the sub themes pool.`;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{getTitle()}</AlertDialogTitle>
          <AlertDialogDescription>{getDescription()}</AlertDialogDescription>
        </AlertDialogHeader>

        {type === 'subTheme' && (
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="delete-codes"
              checked={deleteCodes}
              onCheckedChange={(checked) => setDeleteCodes(checked === true)}
            />
            <Label htmlFor="delete-codes" className="text-sm cursor-pointer">
              Delete codes
            </Label>
          </div>
        )}

        {type === 'mainTheme' && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="delete-subthemes"
                checked={deleteSubThemes}
                onCheckedChange={(checked) =>
                  setDeleteSubThemes(checked === true)
                }
              />
              <Label
                htmlFor="delete-subthemes"
                className="text-sm cursor-pointer"
              >
                Delete sub themes
              </Label>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Checkbox
                id="delete-codes-main"
                checked={deleteCodes}
                onCheckedChange={(checked) => setDeleteCodes(checked === true)}
                disabled={!deleteSubThemes}
              />
              <Label
                htmlFor="delete-codes-main"
                className={`text-sm cursor-pointer ${!deleteSubThemes ? 'text-muted-foreground' : ''}`}
              >
                Delete codes
              </Label>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
