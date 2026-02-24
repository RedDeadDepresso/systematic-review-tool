import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Label as LabelType } from '@/features/references/types/labels';
import { useUpdateLabel } from '@/features/references/hooks/use-labels';

// Preset swatches
const COLOR_SWATCHES = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6b7280', // gray
  '#84cc16', // lime
];

interface LabelEditDialogProps {
  label: LabelType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LabelEditDialog({
  label,
  open,
  onOpenChange,
  onSuccess,
}: LabelEditDialogProps) {
  const [pendingName, setPendingName] = useState<string>(label.name);
  const [pendingHotkey, setPendingHotkey] = useState<string>(
    label.hotkey ?? ''
  );
  const [pendingColor, setPendingColor] = useState<string>(label.color);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const hotkeyInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const updateLabel = useUpdateLabel();

  // Reset state when label changes
  useEffect(() => {
    setPendingName(label.name);
    setPendingHotkey(label.hotkey ?? '');
    setPendingColor(label.color);
    setErrorMessage('');
  }, [label]);

  const handleHotkeyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    parts.push(key);

    setPendingHotkey(parts.join('+'));
    setErrorMessage('');
  };

  const handleSave = async () => {
    const payload: Partial<LabelType> = {
      color: pendingColor,
      hotkey: pendingHotkey,
    };
    const trimmedName = pendingName.trim();
    if (trimmedName && trimmedName !== label.name) {
      payload.name = trimmedName;
    }
    updateLabel.mutate(
      {
        id: label.id,
        payload: payload,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (error: any) => {
          setErrorMessage(error.message || 'Failed to save label');
        },
      }
    );
  };

  useEffect(() => {
    if (open) setTimeout(() => hotkeyInputRef.current?.focus(), 100);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit label "{label.name}"</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Label>Name</Label>
          <Input
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            placeholder="Label name..."
          />
        </div>

        <div className="space-y-6 py-4">
          {/* ── Color ── */}
          <div className="space-y-3">
            <Label>Color</Label>

            {/* Swatches */}
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setPendingColor(color)}
                  className="h-7 w-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: color,
                    borderColor:
                      pendingColor === color ? 'white' : 'transparent',
                    boxShadow:
                      pendingColor === color ? `0 0 0 2px ${color}` : undefined,
                  }}
                />
              ))}

              {/* Custom color — native picker hidden behind a swatch */}
              <button
                type="button"
                onClick={() => colorInputRef.current?.click()}
                className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-xs text-muted-foreground hover:border-foreground transition-colors overflow-hidden"
                style={{
                  // Show custom colour if it's not one of the presets
                  backgroundColor: COLOR_SWATCHES.includes(pendingColor)
                    ? 'transparent'
                    : pendingColor,
                }}
                title="Custom colour"
              >
                {COLOR_SWATCHES.includes(pendingColor) ? '+' : null}
              </button>
              <input
                ref={colorInputRef}
                type="color"
                value={pendingColor}
                onChange={(e) => setPendingColor(e.target.value)}
                className="sr-only"
              />
            </div>

            {/* Hex input */}
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded border border-border shrink-0"
                style={{ backgroundColor: pendingColor }}
              />
              <Input
                value={pendingColor}
                onChange={(e) => {
                  const val = e.target.value;
                  // Allow typing partial hex — only apply when valid
                  if (/^#[0-9a-fA-F]{0,6}$/.test(val)) setPendingColor(val);
                }}
                placeholder="#3b82f6"
                className="font-mono text-sm"
                maxLength={7}
              />
            </div>
          </div>

          {/* ── Hotkey ── */}
          <div className="space-y-3">
            <Label>Hotkey</Label>
            <p className="text-sm text-muted-foreground">
              Press a key combination. When held with references selected, this
              label will be applied automatically.
            </p>
            <div className="relative">
              <Input
                ref={hotkeyInputRef}
                value={pendingHotkey}
                onKeyDown={handleHotkeyKeyDown}
                onChange={() => {}}
                placeholder="Press a key combination..."
                className="text-center font-mono pr-8"
                readOnly
              />
              {pendingHotkey && (
                <button
                  type="button"
                  onClick={() => setPendingHotkey('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Examples: A, Ctrl+1, Shift+I, Alt+E
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateLabel.isPending}>
            {updateLabel.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
