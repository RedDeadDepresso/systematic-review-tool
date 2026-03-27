// Card for a single qualitative code, with edit/delete actions.
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  GripVertical,
  Pencil,
  Trash2,
  X,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { EditItemDialog } from '@/features/coding/components/edit-item-dialog';
import { ItemActionsDropdown } from '@/features/coding/components/item-actions-dropdown';
import { DeleteConfirmationDialog } from '@/features/coding/components/delete-confirmation-dialog';
import type { Code } from '@/features/coding/types/codes';
import { can } from '@/lib/permissions';
import type { ReviewRole } from '@/features/reviews/types/reviews';

interface CodeCardProps {
  userRole: ReviewRole;
  code: Code;
  onEdit: (id: string, name: string, description: string) => void;
  onDelete: (id: string) => void;
  onRemove?: () => void;
  onJump?: (code: Code) => void;
  compact?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
  nested?: boolean;
  /** When true the card renders as a static overlay clone – no drag handle wiring */
  isOverlay?: boolean;
}

export function CodeCard({
  userRole,
  code,
  onEdit,
  onDelete,
  onRemove,
  onJump,
  compact = false,
  isExpanded = true,
  onToggleExpand,
  nested = false,
  isOverlay = false,
}: CodeCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `code-${code.id}`,
      data: { type: 'code', id: code.id },
      disabled: isOverlay,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    // Keep the overlay on top
    zIndex: isOverlay ? 999 : undefined,
  };

  const handleToggle = () => onToggleExpand?.(code.id);
  const handleDeleteClick = () => setDeleteDialogOpen(true);
  const handleConfirmDelete = () => onDelete(code.id);

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...(isOverlay ? {} : { ...listeners, ...attributes })}
        className={`cursor-grab active:cursor-grabbing transition-colors ${compact ? 'bg-secondary' : 'bg-card'} ${
          isOverlay ? 'shadow-xl ring-2 ring-primary' : ''
        }`}
      >
        <CardContent className={compact ? 'p-2' : 'p-3'}>
          <div className="flex items-start gap-2">
            {/* Drag handle */}
            <GripVertical
              className={`${
                compact ? 'h-3 w-3' : 'h-4 w-4'
              } text-muted-foreground mt-0.5 shrink-0`}
            />

            {/* Expand toggle */}
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

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p
                className={`font-medium text-card-foreground ${
                  compact ? 'text-xs' : 'text-sm'
                }`}
              >
                {code.name}
              </p>
              {isExpanded && (
                <div className="mt-1 space-y-1">
                  {code.content?.text?.trim() && (
                    <p
                      className={`text-muted-foreground line-clamp-2 italic border-l-2 border-muted-foreground/40 pl-1.5 ${
                        compact ? 'text-[10px]' : 'text-xs'
                      }`}
                    >
                      "{code.content.text.trim()}"
                    </p>
                  )}
                  {code?.comment && (
                    <p
                      className={`text-muted-foreground line-clamp-2 ${
                        compact ? 'text-[10px]' : 'text-xs'
                      }`}
                    >
                      {code.comment}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {nested && can('modifyThemesCodes', userRole) ? (
                <>
                  <ItemActionsDropdown
                    type="code"
                    name={code.name}
                    description={code?.comment ?? ''}
                    onEdit={(name, description) =>
                      onEdit(code.id, name, description)
                    }
                    onDelete={handleDeleteClick}
                    onJump={onJump ? () => onJump(code) : undefined}
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
                  {onJump && code.position && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={compact ? 'h-5 w-5' : 'h-6 w-6'}
                      onClick={() => onJump(code)}
                      title="Jump to reference"
                    >
                      <ArrowUpRight
                        className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'}
                      />
                    </Button>
                  )}
                  {can('modifyThemesCodes', userRole) && (
                    <>
                      <EditItemDialog
                        type="code"
                        initialName={code.name}
                        initialDescription={code?.comment ?? ''}
                        onSave={(name, description) =>
                          onEdit(code.id, name, description)
                        }
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className={compact ? 'h-5 w-5' : 'h-6 w-6'}
                        >
                          <Pencil
                            className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'}
                          />
                        </Button>
                      </EditItemDialog>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={compact ? 'h-5 w-5' : 'h-6 w-6'}
                        onClick={handleDeleteClick}
                      >
                        <Trash2
                          className={`${
                            compact ? 'h-2.5 w-2.5' : 'h-3 w-3'
                          } text-destructive`}
                        />
                      </Button>
                    </>
                  )}
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
        </CardContent>
      </Card>

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        type="code"
        itemName={code.name}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
