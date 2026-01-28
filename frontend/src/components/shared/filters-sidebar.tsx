'use client';

import React from 'react';

import { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  LayoutList,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Keyword } from '@/types/keyword';
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
import { useIsMobile } from '@/hooks/use-mobile';
import type { ArticleViewLayout, Label } from '@/types/reference';

interface FiltersSidebarProps {
  keywords: Keyword[];
  labels: Label[];
  selectedIncludeKeywords: string[];
  selectedExcludeKeywords: string[];
  selectedLabels: number[];
  onIncludeKeywordToggle: (keyword: string) => void;
  onExcludeKeywordToggle: (keyword: string) => void;
  onSelectAllInclude: () => void;
  onSelectAllExclude: () => void;
  onLabelToggle: (labelId: number) => void;
  onSelectAllLabels: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  includeHighlightEnabled: boolean;
  excludeHighlightEnabled: boolean;
  onToggleIncludeHighlight: () => void;
  onToggleExcludeHighlight: () => void;
  onCreateKeyword: (name: string, isInclusive: boolean) => void;
  onDeleteKeyword?: (keyword: Keyword) => void;
  onDeleteLabel?: (label: Label) => void;
  articleViewLayout: ArticleViewLayout;
  onArticleViewLayoutChange: (layout: ArticleViewLayout) => void;
}

export function FiltersSidebar({
  keywords,
  selectedIncludeKeywords,
  selectedExcludeKeywords,
  labels,
  selectedLabels,
  onIncludeKeywordToggle,
  onExcludeKeywordToggle,
  onSelectAllInclude,
  onSelectAllExclude,
  onLabelToggle,
  onSelectAllLabels,
  isCollapsed,
  includeHighlightEnabled,
  excludeHighlightEnabled,
  onToggleIncludeHighlight,
  onToggleExcludeHighlight,
  onCreateKeyword,
  onDeleteKeyword,
  onDeleteLabel,
  articleViewLayout,
  onArticleViewLayoutChange,
}: FiltersSidebarProps) {
  const isMobile = useIsMobile();
  const [searchFilter, setSearchFilter] = useState('');
  const [showMoreInclude, setShowMoreInclude] = useState(false);
  const [showMoreExclude, setShowMoreExclude] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showAddIncludeInput, setShowAddIncludeInput] = useState(false);
  const [showAddExcludeInput, setShowAddExcludeInput] = useState(false);
  const [newIncludeKeyword, setNewIncludeKeyword] = useState('');
  const [newExcludeKeyword, setNewExcludeKeyword] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addIncludeInputRef = useRef<HTMLInputElement>(null);
  const addExcludeInputRef = useRef<HTMLInputElement>(null);

  const includeKeywords = keywords.filter((k) => k.isInclusive);
  const excludeKeywords = keywords.filter((k) => !k.isInclusive);
  const [deleteConfirmKeyword, setDeleteConfirmKeyword] =
    useState<Keyword | null>(null);
  const [deleteConfirmLabel, setDeleteConfirmLabel] = useState<Label | null>(
    null
  );

  const filteredIncludeKeywords = includeKeywords.filter((k) =>
    k.name.toLowerCase().includes(searchFilter.toLowerCase())
  );
  const filteredExcludeKeywords = excludeKeywords.filter((k) =>
    k.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const visibleIncludeKeywords = showMoreInclude
    ? filteredIncludeKeywords
    : filteredIncludeKeywords.slice(0, 8);

  const visibleExcludeKeywords = showMoreExclude
    ? filteredExcludeKeywords
    : filteredExcludeKeywords.slice(0, 8);

  const allIncludeSelected =
    includeKeywords.length > 0 &&
    includeKeywords.every((k) => selectedIncludeKeywords.includes(k.name));

  const allExcludeSelected =
    excludeKeywords.length > 0 &&
    excludeKeywords.every((k) => selectedExcludeKeywords.includes(k.name));

  useEffect(() => {
    if (isMobile) onArticleViewLayoutChange('title-only');
  }, [isMobile]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (showAddIncludeInput && addIncludeInputRef.current) {
      addIncludeInputRef.current.focus();
    }
  }, [showAddIncludeInput]);

  useEffect(() => {
    if (showAddExcludeInput && addExcludeInputRef.current) {
      addExcludeInputRef.current.focus();
    }
  }, [showAddExcludeInput]);

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    setSearchFilter('');
  };

  const handleAddIncludeKeyword = () => {
    if (newIncludeKeyword.trim()) {
      onCreateKeyword(newIncludeKeyword.trim(), true);
      setNewIncludeKeyword('');
      setShowAddIncludeInput(false);
    }
  };

  const handleAddExcludeKeyword = () => {
    if (newExcludeKeyword.trim()) {
      onCreateKeyword(newExcludeKeyword.trim(), false);
      setNewExcludeKeyword('');
      setShowAddExcludeInput(false);
    }
  };

  const handleIncludeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddIncludeKeyword();
    } else if (e.key === 'Escape') {
      setNewIncludeKeyword('');
      setShowAddIncludeInput(false);
    }
  };

  const handleExcludeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddExcludeKeyword();
    } else if (e.key === 'Escape') {
      setNewExcludeKeyword('');
      setShowAddExcludeInput(false);
    }
  };

  const handleDeleteKeyword = (keyword: Keyword) => {
    if (onDeleteKeyword) {
      onDeleteKeyword(keyword);
    }
    setDeleteConfirmKeyword(null);
  };

  const handleDeleteLabel = (label: Label) => {
    if (onDeleteLabel) {
      onDeleteLabel(label);
    }
    setDeleteConfirmLabel(null);
  };

  return (
    <aside
      className={cn(
        'w-64 sm:w-72 border-l border-border bg-card flex flex-col h-full',
        isCollapsed && 'hidden'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {isSearchOpen ? (
          <div className="flex items-center gap-2 flex-1 animate-in slide-in-from-right-4 duration-200">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search keywords..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-8 pl-8 pr-8 text-sm w-full"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                onClick={handleSearchClose}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold">Filters</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsSearchOpen(true)}
              >
                <Search className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Keywords to Include */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary flex items-center justify-center">
                <svg
                  className="w-2.5 h-2.5 text-primary-foreground"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="text-sm font-medium">Keywords for include</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 w-6 p-0 transition-colors',
                  includeHighlightEnabled
                    ? 'bg-primary/10 hover:bg-primary/20'
                    : 'hover:bg-muted'
                )}
                onClick={onToggleIncludeHighlight}
                title={
                  includeHighlightEnabled
                    ? 'Disable highlighting'
                    : 'Enable highlighting'
                }
              >
                <X
                  className={cn(
                    'h-3 w-3',
                    includeHighlightEnabled
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  )}
                />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowAddIncludeInput(!showAddIncludeInput)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Add keyword input */}
          {showAddIncludeInput && (
            <div className="mb-3 animate-in slide-in-from-top-2 duration-200">
              <Input
                ref={addIncludeInputRef}
                placeholder="Enter keyword and press Enter"
                value={newIncludeKeyword}
                onChange={(e) => setNewIncludeKeyword(e.target.value)}
                onKeyDown={handleIncludeKeyDown}
                onBlur={() => {
                  if (!newIncludeKeyword.trim()) {
                    setShowAddIncludeInput(false);
                  }
                }}
                className="h-8 text-sm"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2">
              <Checkbox
                checked={allIncludeSelected}
                onCheckedChange={onSelectAllInclude}
              />
              <span className="text-sm text-muted-foreground">Select All</span>
            </label>

            {visibleIncludeKeywords.map((keyword) => (
              <div
                key={keyword.name}
                className="flex items-center justify-between py-1.5 hover:bg-muted/50 rounded px-2 -mx-2"
              >
                <label className="flex items-center gap-3 flex-1 cursor-pointer">
                  <Checkbox
                    checked={selectedIncludeKeywords.includes(keyword.name)}
                    onCheckedChange={() => onIncludeKeywordToggle(keyword.name)}
                  />
                  <span className="text-sm">{keyword.name}</span>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-destructive/10"
                  onClick={() => setDeleteConfirmKeyword(keyword)}
                  title="Delete keyword"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {filteredIncludeKeywords.length > 8 && (
            <button
              onClick={() => setShowMoreInclude(!showMoreInclude)}
              className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
            >
              {showMoreInclude ? (
                <>
                  Show less <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  Show more <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Keywords to Exclude */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-destructive flex items-center justify-center">
                <X className="h-2.5 w-2.5 text-white" />
              </div>
              <span className="text-sm font-medium">Keywords for exclude</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 w-6 p-0 transition-colors',
                  excludeHighlightEnabled
                    ? 'bg-destructive/10 hover:bg-destructive/20'
                    : 'hover:bg-muted'
                )}
                onClick={onToggleExcludeHighlight}
                title={
                  excludeHighlightEnabled
                    ? 'Disable highlighting'
                    : 'Enable highlighting'
                }
              >
                <X
                  className={cn(
                    'h-3 w-3',
                    excludeHighlightEnabled
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  )}
                />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowAddExcludeInput(!showAddExcludeInput)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Add keyword input */}
          {showAddExcludeInput && (
            <div className="mb-3 animate-in slide-in-from-top-2 duration-200">
              <Input
                ref={addExcludeInputRef}
                placeholder="Enter keyword and press Enter"
                value={newExcludeKeyword}
                onChange={(e) => setNewExcludeKeyword(e.target.value)}
                onKeyDown={handleExcludeKeyDown}
                onBlur={() => {
                  if (!newExcludeKeyword.trim()) {
                    setShowAddExcludeInput(false);
                  }
                }}
                className="h-8 text-sm"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2">
              <Checkbox
                checked={allExcludeSelected}
                onCheckedChange={onSelectAllExclude}
              />
              <span className="text-sm text-muted-foreground">Select All</span>
            </label>

            {visibleExcludeKeywords.map((keyword) => (
              <div
                key={keyword.name}
                className="flex items-center justify-between py-1.5 hover:bg-muted/50 rounded px-2 -mx-2"
              >
                <label className="flex items-center gap-3 flex-1 cursor-pointer">
                  <Checkbox
                    checked={selectedExcludeKeywords.includes(keyword.name)}
                    onCheckedChange={() => onExcludeKeywordToggle(keyword.name)}
                  />
                  <span className="text-sm">{keyword.name}</span>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-destructive/10"
                  onClick={() => setDeleteConfirmKeyword(keyword)}
                  title="Delete keyword"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {filteredExcludeKeywords.length > 8 && (
            <button
              onClick={() => setShowMoreExclude(!showMoreExclude)}
              className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
            >
              {showMoreExclude ? (
                <>
                  Show less <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  Show more <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Labels Section */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-muted-foreground flex items-center justify-center">
                <span className="text-[8px]">L</span>
              </div>
              <span className="text-sm font-medium">Labels</span>
            </div>
          </div>

          <div className="space-y-1">
            {/* Select all (optional) */}
            <label className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2">
              <Checkbox
                checked={
                  labels.length > 0 &&
                  labels.every((l) => selectedLabels.includes(l.id))
                }
                onCheckedChange={onSelectAllLabels}
              />
              <span className="text-sm text-muted-foreground">Select All</span>
            </label>

            {labels.map((label) => (
              <div
                key={label.id}
                onClick={() => onLabelToggle(label.id)}
                className={cn(
                  'flex items-center justify-between w-full px-2 py-1.5 rounded cursor-pointer hover:bg-muted/50 transition-colors group',
                  selectedLabels.includes(label.id) && 'bg-muted'
                )}
              >
                <span className="flex items-center gap-3 truncate">
                  <Checkbox
                    checked={selectedLabels.includes(label.id)}
                    onCheckedChange={() => onLabelToggle(label.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm truncate max-w-[120px]">
                    {label.name}
                  </span>
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {label.count}
                  </span>

                  {onDeleteLabel && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmLabel(label);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete label"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Articles Layout Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <LayoutList className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Articles Layout</span>
            </div>
          </div>
          <div className="space-y-1">
            <label
              aria-disabled={isMobile}
              className={cn(
                'flex items-center gap-3 py-1.5 rounded px-2 -mx-2',
                isMobile
                  ? 'opacity-50 cursor-not-allowed pointer-events-none'
                  : 'cursor-pointer hover:bg-muted/50'
              )}
              onClick={() => {
                if (isMobile) return;
                onArticleViewLayoutChange('title-abstract');
              }}
            >
              <div
                className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                  articleViewLayout === 'title-abstract'
                    ? 'border-primary'
                    : 'border-muted-foreground'
                )}
              >
                {articleViewLayout === 'title-abstract' && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-sm">Title & Abstract view</span>
            </label>
            <label
              className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2"
              onClick={() => onArticleViewLayoutChange('title-only')}
            >
              <div
                className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                  articleViewLayout === 'title-only'
                    ? 'border-primary'
                    : 'border-muted-foreground'
                )}
              >
                {articleViewLayout === 'title-only' && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-sm">Title only view</span>
            </label>
          </div>
        </div>

        {/* Delete Keyword Confirmation Dialog */}
        <AlertDialog
          open={deleteConfirmKeyword !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirmKeyword(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Keyword</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the keyword "
                {deleteConfirmKeyword?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteConfirmKeyword) {
                    handleDeleteKeyword(deleteConfirmKeyword);
                  }
                }}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Label Confirmation Dialog */}
        <AlertDialog
          open={deleteConfirmLabel !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirmLabel(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Label</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the label "
                {deleteConfirmLabel?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteConfirmLabel) {
                    handleDeleteLabel(deleteConfirmLabel);
                  }
                }}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </aside>
  );
}
