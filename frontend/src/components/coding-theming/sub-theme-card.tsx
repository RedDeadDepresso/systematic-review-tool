'use client';

import type React from 'react';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  GripVertical,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { CodeCard } from './code-card';
import { EditItemDialog } from './edit-item-dialog';
import { ItemActionsDropdown } from './item-actions-dropdown';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import type { SubTheme } from '@/types/sub-theme';
import type { Code } from '@/types/code';

interface SubThemeCardProps {
  subTheme: SubTheme;
  onEdit: (id: number, name: string, description: string) => void;
  onDelete: (id: number, options?: { deleteCodes?: boolean }) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDropCode: () => void;
  onRemoveCode: (codeId: number) => void;
  onEditCode: (id: number, name: string, description: string) => void;
  onDeleteCode: (id: number) => void;
  onRemove?: () => void;
  isDraggingCode?: boolean;
  compact?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (id: number) => void;
  nested?: boolean;
  onJumpCode?: (code: Code) => void;
  expandedCodes?: Set<number>;
  onToggleCode?: (id: number) => void;
}

export function SubThemeCard({
  subTheme,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  onDropCode,
  onRemoveCode,
  onEditCode,
  onDeleteCode,
  onRemove,
  isDraggingCode,
  compact = false,
  isExpanded = true,
  onToggleExpand,
  nested = false,
  onJumpCode,
  expandedCodes,
  onToggleCode,
}: SubThemeCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd?.();
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isDraggingCode) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isDraggingCode) {
      onDropCode();
    }
  };

  const handleToggle = () => {
    onToggleExpand?.(subTheme.id);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = (options?: { deleteCodes?: boolean }) => {
    onDelete(subTheme.id, options);
  };

  return (
    <>
      <Card
        draggable={!compact || !!onDragStart}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`transition-all ${isDragging ? 'opacity-50 scale-95' : ''} ${
          isDragOver ? 'ring-2 ring-primary bg-primary/5' : ''
        } ${compact ? 'bg-secondary' : 'bg-card'} ${onDragStart ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <CardHeader className={compact ? 'p-2 pb-1' : 'p-3 pb-2'}>
          <div className="flex items-start gap-2">
            {onDragStart && (
              <GripVertical
                className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} text-muted-foreground mt-0.5 shrink-0`}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} shrink-0 p-0`}
              onClick={handleToggle}
            >
              {isExpanded ? (
                <ChevronDown className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
              ) : (
                <ChevronRight className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
              )}
            </Button>
            <div className="flex-1 min-w-0">
              <p
                className={`font-medium text-card-foreground ${compact ? 'text-xs' : 'text-sm'}`}
              >
                {subTheme.name}
              </p>
              {isExpanded && (
                <p
                  className={`text-muted-foreground line-clamp-2 mt-1 ${compact ? 'text-[10px]' : 'text-xs'}`}
                >
                  {subTheme.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {nested ? (
                <>
                  <ItemActionsDropdown
                    type="subTheme"
                    name={subTheme.name}
                    description={subTheme.description}
                    onEdit={(name, description) =>
                      onEdit(subTheme.id, name, description)
                    }
                    onDelete={handleDeleteClick}
                    compact={compact}
                  />
                  {onRemove && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={compact ? 'h-5 w-5' : 'h-6 w-6'}
                      onClick={onRemove}
                    >
                      <X className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <EditItemDialog
                    type="subTheme"
                    initialName={subTheme.name}
                    initialDescription={subTheme.description}
                    onSave={(name, description) =>
                      onEdit(subTheme.id, name, description)
                    }
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className={compact ? 'h-5 w-5' : 'h-6 w-6'}
                    >
                      <Pencil className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                    </Button>
                  </EditItemDialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={compact ? 'h-5 w-5' : 'h-6 w-6'}
                    onClick={handleDeleteClick}
                  >
                    <Trash2
                      className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-destructive`}
                    />
                  </Button>
                  {onRemove && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={compact ? 'h-5 w-5' : 'h-6 w-6'}
                      onClick={onRemove}
                    >
                      <X className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className={compact ? 'p-2 pt-0' : 'p-3 pt-0'}>
            <div
              className={`min-h-[40px] rounded border border-dashed p-2 space-y-2 ${
                isDragOver ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              {subTheme.codes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Drop codes here
                </p>
              ) : (
                subTheme.codes.map((code) => (
                  <CodeCard
                    key={code.id}
                    code={code}
                    onEdit={onEditCode}
                    onDelete={onDeleteCode}
                    onRemove={() => onRemoveCode(code.id)}
                    onJump={onJumpCode}
                    compact
                    nested
                    isExpanded={expandedCodes?.has(code.id) ?? true}
                    onToggleExpand={onToggleCode}
                  />
                ))
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        type="subTheme"
        itemName={subTheme.name}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
