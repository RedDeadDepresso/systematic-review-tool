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
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CodeCard } from '@/features/coding/components/codes/code-card';
import { EditItemDialog } from '@/features/coding/components/edit-item-dialog';
import { ItemActionsDropdown } from '@/features/coding/components/item-actions-dropdown';
import { DeleteConfirmationDialog } from '@/features/coding/components/delete-confirmation-dialog';
import type { SubTheme } from '@/features/coding/types/sub-themes';
import type { Code } from '@/features/coding/types/codes';
import type { ReviewRole } from '@/features/reviews/types/reviews';
import { can } from '@/lib/permissions';

interface SubThemeCardProps {
  userRole: ReviewRole;
  subTheme: SubTheme;
  codesMap: Record<string, Code>;
  onEdit: (id: number, name: string, description: string) => void;
  onDelete: (id: number, options?: { deleteCodes?: boolean }) => void;
  onRemoveCode: (codeId: string) => void;
  onEditCode: (id: string, name: string, description: string) => void;
  onDeleteCode: (id: string) => void;
  onRemove?: () => void;
  compact?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (id: number) => void;
  nested?: boolean;
  onJumpCode?: (code: Code) => void;
  expandedCodes?: Set<string>;
  onToggleCode?: (id: string) => void;
  /** Overlay clone rendered inside DragOverlay – skips drag/drop wiring */
  isOverlay?: boolean;
}

export function SubThemeCard({
  userRole,
  subTheme,
  codesMap,
  onEdit,
  onDelete,
  onRemoveCode,
  onEditCode,
  onDeleteCode,
  onRemove,
  compact = false,
  isExpanded = true,
  onToggleExpand,
  nested = false,
  onJumpCode,
  expandedCodes,
  onToggleCode,
  isOverlay = false,
}: SubThemeCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ── Draggable (the card itself can be dragged to a MainTheme or the flat list) ──
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `subtheme-${subTheme.id}`,
    data: { type: 'subTheme', id: subTheme.id },
    disabled: isOverlay,
  });

  // ── Droppable (codes can be dropped onto this sub-theme) ──────────────────
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `subtheme-${subTheme.id}`,
    disabled: isOverlay,
  });

  // Merge both refs onto the card root so it's both draggable and droppable
  const setCardRef = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isOverlay ? 999 : undefined,
  };

  const handleToggle = () => onToggleExpand?.(subTheme.id);
  const handleDeleteClick = () => setDeleteDialogOpen(true);
  const handleConfirmDelete = (options?: { deleteCodes?: boolean }) =>
    onDelete(subTheme.id, options);

  return (
    <>
      <Card
        ref={setCardRef}
        style={style}
        {...(isOverlay ? {} : { ...listeners, ...attributes })}
        className={`cursor-grab active:cursor-grabbing transition-colors ${compact ? 'bg-secondary' : 'bg-card'} ${
          isOver ? 'ring-2 ring-primary bg-primary/5' : ''
        } ${isOverlay ? 'shadow-xl ring-2 ring-primary' : ''}`}
      >
        <CardHeader className={compact ? 'p-2 pb-1' : 'p-3 pb-2'}>
          <div className="flex items-start gap-2">
            {/* Drag handle – only shown when not in overlay mode */}
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

            {/* Name + description */}
            <div className="flex-1 min-w-0">
              <p
                className={`font-medium text-card-foreground ${
                  compact ? 'text-xs' : 'text-sm'
                }`}
              >
                {subTheme.name}
              </p>
              {isExpanded && (
                <p
                  className={`text-muted-foreground line-clamp-2 mt-1 ${
                    compact ? 'text-[10px]' : 'text-xs'
                  }`}
                >
                  {subTheme.description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {nested && can('modifyThemesCodes', userRole) ? (
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
                      className={`${
                        compact ? 'h-2.5 w-2.5' : 'h-3 w-3'
                      } text-destructive`}
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
              className={`min-h-[40px] rounded border border-dashed p-2 space-y-2 transition-colors ${
                isOver ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              {subTheme.codeIds.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Drop codes here
                </p>
              ) : (
                subTheme.codeIds.map((codeId) => {
                  const code = codesMap[codeId];
                  if (!code) return null;
                  return (
                    <CodeCard
                      userRole={userRole}
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
                  );
                })
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
