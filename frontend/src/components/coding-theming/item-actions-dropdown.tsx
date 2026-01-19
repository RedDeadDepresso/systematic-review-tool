'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, ArrowUpRight } from 'lucide-react';
import { EditItemDialog } from './edit-item-dialog';

interface ItemActionsDropdownProps {
  type: 'code' | 'subTheme' | 'mainTheme';
  name: string;
  description: string;
  onEdit: (name: string, description: string) => void;
  onDelete: () => void;
  onJump?: () => void;
  compact?: boolean;
}

export function ItemActionsDropdown({
  type,
  name,
  description,
  onEdit,
  onDelete,
  onJump,
  compact = false,
}: ItemActionsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={compact ? 'h-5 w-5' : 'h-6 w-6'}
        >
          <MoreHorizontal className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {onJump && (
          <DropdownMenuItem onClick={onJump} className="cursor-pointer">
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Jump
          </DropdownMenuItem>
        )}
        <EditItemDialog
          type={type}
          initialName={name}
          initialDescription={description}
          onSave={onEdit}
        >
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="cursor-pointer"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
        </EditItemDialog>
        <DropdownMenuItem
          onClick={onDelete}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
