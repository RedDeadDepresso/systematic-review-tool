'use client';

import React from 'react';

import { useState, useEffect, useRef } from 'react';
import { X, Pencil, Minus, Send, SquareSlash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { cn } from '@/lib/utils';

export interface Criteria {
  id: string;
  name: string;
  description: string;
  type: 'inclusion' | 'exclusion';
}

interface ScreeningCriteriaPopoverProps {
  trigger: React.ReactNode;
  criteria: Criteria[];
  onCriteriaChange: (criteria: Criteria[]) => void;
}

export function ScreeningCriteriaPopover({
  trigger,
  criteria,
  onCriteriaChange,
}: ScreeningCriteriaPopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'inclusion' | 'exclusion'>(
    'inclusion'
  );
  const [newCriteriaText, setNewCriteriaText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [criteriaToDelete, setCriteriaToDelete] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut to open popover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const inclusionCriteria = criteria.filter((c) => c.type === 'inclusion');
  const exclusionCriteria = criteria.filter((c) => c.type === 'exclusion');
  const currentCriteria =
    activeTab === 'inclusion' ? inclusionCriteria : exclusionCriteria;

  const handleAddCriteria = () => {
    if (!newCriteriaText.trim()) return;

    const count =
      activeTab === 'inclusion'
        ? inclusionCriteria.length
        : exclusionCriteria.length;
    const newCriteria: Criteria = {
      id: `${activeTab}-${Date.now()}`,
      name: `${activeTab === 'inclusion' ? 'Inclusion' : 'Exclusion'} Criteria ${count + 1}`,
      description: newCriteriaText.trim(),
      type: activeTab,
    };

    onCriteriaChange([...criteria, newCriteria]);
    setNewCriteriaText('');
  };

  const handleEditStart = (c: Criteria) => {
    setEditingId(c.id);
    setEditingText(c.description);
  };

  const handleEditSave = (id: string) => {
    if (!editingText.trim()) {
      setEditingId(null);
      return;
    }

    onCriteriaChange(
      criteria.map((c) =>
        c.id === id ? { ...c, description: editingText.trim() } : c
      )
    );
    setEditingId(null);
    setEditingText('');
  };

  const handleDeleteClick = (id: string) => {
    setCriteriaToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (criteriaToDelete) {
      onCriteriaChange(criteria.filter((c) => c.id !== criteriaToDelete));
    }
    setDeleteDialogOpen(false);
    setCriteriaToDelete(null);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <SquareSlash className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold">Screening Criteria</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Keyboard hint */}
          <div className="px-4 py-2 text-sm text-primary">
            Or press "c" on the keyboard to view criteria
          </div>

          {/* Tabs */}
          <div className="px-4">
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setActiveTab('inclusion')}
                className={cn(
                  'flex-1 px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === 'inclusion'
                    ? 'bg-background text-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                )}
              >
                Inclusion Criteria
              </button>
              <button
                onClick={() => setActiveTab('exclusion')}
                className={cn(
                  'flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-border',
                  activeTab === 'exclusion'
                    ? 'bg-background text-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                )}
              >
                Exclusion Criteria
              </button>
            </div>
          </div>

          {/* Criteria List */}
          <div className="px-4 py-3 min-h-[150px] max-h-[250px] overflow-y-auto">
            {currentCriteria.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No {activeTab} criteria yet
              </p>
            ) : (
              <div className="space-y-3">
                {currentCriteria.map((c) => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-primary">
                        {c.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleEditStart(c)}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleDeleteClick(c.id)}
                        >
                          <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                    {editingId === c.id ? (
                      <div className="flex gap-2">
                        <Input
                          ref={editInputRef}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSave(c.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="h-8 text-sm"
                          placeholder="Enter criteria description..."
                        />
                        <Button
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => handleEditSave(c.id)}
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground">{c.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Criteria Input */}
          <div className="px-4 py-3 border-t border-border">
            <div className="flex items-center gap-2">
              <Input
                value={newCriteriaText}
                onChange={(e) => setNewCriteriaText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCriteria();
                }}
                placeholder={`Add ${activeTab} Criteria`}
                className="h-9 text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={handleAddCriteria}
                disabled={!newCriteriaText.trim()}
              >
                <Send
                  className={cn(
                    'h-4 w-4',
                    newCriteriaText.trim()
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  )}
                />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Criteria</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this criteria? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
