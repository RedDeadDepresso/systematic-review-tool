import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SubThemeCard } from '@/features/coding/components/sub-themes/sub-theme-card';
import { EditItemDialog } from '@/features/coding/components/edit-item-dialog';
import { DeleteConfirmationDialog } from '@/features/coding/components/delete-confirmation-dialog';
import type { MainTheme } from '@/features/coding/types/main-themes';
import type { Code } from '@/features/coding/types/codes';
import type { SubTheme } from '@/features/coding/types/sub-themes';
import type { ReviewRole } from '@/features/reviews/types/reviews';

interface MainThemeCardProps {
  userRole: ReviewRole;
  mainTheme: MainTheme;
  codesMap: Record<string, Code>;
  subThemesMap: Record<number, SubTheme>;
  onEdit: (id: number, name: string, description: string) => void;
  onDelete: (
    id: number,
    options?: { deleteSubThemes?: boolean; deleteCodes?: boolean }
  ) => void;
  onRemoveSubTheme: (subThemeId: number) => void;
  onEditSubTheme: (id: number, name: string, description: string) => void;
  onDeleteSubTheme: (id: number, options?: { deleteCodes?: boolean }) => void;
  onRemoveCode: (codeId: string) => void;
  onEditCode: (id: string, name: string, description: string) => void;
  onDeleteCode: (id: string) => void;
  compact?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (id: number) => void;
  onJumpCode?: (code: Code) => void;
  expandedSubThemes?: Set<number>;
  onToggleSubTheme?: (id: number) => void;
  expandedCodes?: Set<string>;
  onToggleCode?: (id: string) => void;
}

export function MainThemeCard({
  userRole,
  mainTheme,
  codesMap,
  subThemesMap,
  onEdit,
  onDelete,
  onRemoveSubTheme,
  onEditSubTheme,
  onDeleteSubTheme,
  onRemoveCode,
  onEditCode,
  onDeleteCode,
  compact = false,
  isExpanded = true,
  onToggleExpand,
  onJumpCode,
  expandedSubThemes,
  onToggleSubTheme,
  expandedCodes,
  onToggleCode,
}: MainThemeCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Sub-themes (and codes inside sub-themes) can be dropped here
  const { setNodeRef, isOver } = useDroppable({
    id: `maintheme-${mainTheme.id}`,
  });

  const handleToggle = () => onToggleExpand?.(mainTheme.id);
  const handleDeleteClick = () => setDeleteDialogOpen(true);
  const handleConfirmDelete = (options?: {
    deleteSubThemes?: boolean;
    deleteCodes?: boolean;
  }) => onDelete(mainTheme.id, options);

  return (
    <>
      <Card
        className={`transition-colors ${compact ? 'bg-secondary' : 'bg-card'} ${
          isOver ? 'ring-2 ring-primary bg-primary/5' : ''
        }`}
      >
        <CardHeader className={compact ? 'p-2 pb-1' : 'p-4 pb-2'}>
          <div className="flex items-start gap-2">
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

            <div className="flex-1 min-w-0">
              <p
                className={`font-medium text-card-foreground ${
                  compact ? 'text-xs' : 'text-sm'
                }`}
              >
                {mainTheme.name}
              </p>
              {isExpanded && (
                <p
                  className={`text-muted-foreground line-clamp-2 mt-1 ${
                    compact ? 'text-[10px]' : 'text-xs'
                  }`}
                >
                  {mainTheme.description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <EditItemDialog
                type="mainTheme"
                initialName={mainTheme.name}
                initialDescription={mainTheme.description}
                onSave={(name, description) =>
                  onEdit(mainTheme.id, name, description)
                }
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className={compact ? 'h-5 w-5' : 'h-7 w-7'}
                >
                  <Pencil className={compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
                </Button>
              </EditItemDialog>
              <Button
                variant="ghost"
                size="icon"
                className={compact ? 'h-5 w-5' : 'h-7 w-7'}
                onClick={handleDeleteClick}
              >
                <Trash2
                  className={`${
                    compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'
                  } text-destructive`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className={compact ? 'p-2 pt-0' : 'p-4 pt-2'}>
            {/* Drop zone for sub-themes */}
            <div
              ref={setNodeRef}
              className={`${
                compact
                  ? 'min-h-[40px] p-2 space-y-2'
                  : 'min-h-[60px] p-3 space-y-3'
              } rounded border border-dashed transition-colors ${
                isOver ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              {mainTheme.subThemeIds.length === 0 ? (
                <p
                  className={`text-xs text-muted-foreground text-center ${
                    compact ? 'py-2' : 'py-4'
                  }`}
                >
                  Drop sub themes here
                </p>
              ) : (
                mainTheme.subThemeIds.map((subThemeId) => {
                  const subTheme = subThemesMap[subThemeId];
                  if (!subTheme) return null;
                  return (
                    <SubThemeCard
                      userRole={userRole}
                      key={subTheme.id}
                      subTheme={subTheme}
                      codesMap={codesMap}
                      onEdit={onEditSubTheme}
                      onDelete={onDeleteSubTheme}
                      onRemoveCode={onRemoveCode}
                      onEditCode={onEditCode}
                      onDeleteCode={onDeleteCode}
                      onRemove={() => onRemoveSubTheme(subTheme.id)}
                      compact
                      nested
                      onJumpCode={onJumpCode}
                      isExpanded={expandedSubThemes?.has(subTheme.id) ?? true}
                      onToggleExpand={onToggleSubTheme}
                      expandedCodes={expandedCodes}
                      onToggleCode={onToggleCode}
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
        type="mainTheme"
        itemName={mainTheme.name}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
