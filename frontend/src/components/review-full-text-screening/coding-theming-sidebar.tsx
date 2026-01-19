'use client';

import { useState, useMemo, useCallback } from 'react';
import { MainThemeCard } from '../coding-theming/main-theme-card';
import { SubThemeCard } from '../coding-theming/sub-theme-card';
import { CodeCard } from '../coding-theming/code-card';
import { CreateItemDialog } from '../coding-theming/create-item-dialog';
import { SectionSearch } from '../coding-theming/section-search';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, ChevronDown, ChevronRight, Network } from 'lucide-react';
import { useCodingTheming } from '@/hooks/use-coding-theming';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import type { Code } from '@/types/code';

interface CodingThemingSidebarProps {
  reviewId: number;
  referenceId?: number;
  isOpen: boolean;
  handleJumpToCode: (code: Code) => void;
}

export function CodingThemingSidebar({
  reviewId,
  referenceId,
  isOpen,
  handleJumpToCode,
}: CodingThemingSidebarProps) {
  const {
    codes,
    subThemes,
    mainThemes,
    draggedItem,
    handleCreateCode,
    handleCreateSubTheme,
    handleCreateMainTheme,
    handleEditCode,
    handleEditSubTheme,
    handleEditMainTheme,
    handleDeleteCode,
    handleDeleteSubTheme,
    handleDeleteMainTheme,
    handleDragStart,
    handleDragEnd,
    handleDropCodeOnSubTheme,
    handleDropSubThemeOnMainTheme,
    handleRemoveCodeFromSubTheme,
    handleRemoveSubThemeFromMainTheme,
  } = useCodingTheming(reviewId);

  const [codesOpen, setCodesOpen] = useState(true);
  const [subThemesOpen, setSubThemesOpen] = useState(true);
  const [mainThemesOpen, setMainThemesOpen] = useState(true);

  const [codesSearch, setCodesSearch] = useState('');
  const [subThemesSearch, setSubThemesSearch] = useState('');
  const [mainThemesSearch, setMainThemesSearch] = useState('');

  const [filterByCurrentReference, setFilterByCurrentReference] =
    useState(false);

  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(
    new Set(codes.map((c) => c.id))
  );
  const [expandedSubThemes, setExpandedSubThemes] = useState<Set<number>>(
    new Set(subThemes.map((st) => st.id))
  );
  const [expandedMainThemes, setExpandedMainThemes] = useState<Set<number>>(
    new Set(mainThemes.map((mt) => mt.id))
  );

  const handleToggleCode = useCallback((id: string) => {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleSubTheme = useCallback((id: number) => {
    setExpandedSubThemes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleMainTheme = useCallback((id: number) => {
    setExpandedMainThemes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allCodeIds = useMemo(() => {
    const ids = new Set(codes.map((c) => c.id));
    subThemes.forEach((st) => st.codes.forEach((c) => ids.add(c.id)));
    mainThemes.forEach((mt) =>
      mt.subThemes.forEach((st) => st.codes.forEach((c) => ids.add(c.id)))
    );
    return ids;
  }, [codes, subThemes, mainThemes]);

  const allSubThemeIds = useMemo(() => {
    const ids = new Set(subThemes.map((st) => st.id));
    mainThemes.forEach((mt) => mt.subThemes.forEach((st) => ids.add(st.id)));
    return ids;
  }, [subThemes, mainThemes]);

  const handleExpandAllCodes = () => setExpandedCodes(new Set(allCodeIds));
  const handleCollapseAllCodes = () => setExpandedCodes(new Set());
  const handleExpandAllSubThemes = () =>
    setExpandedSubThemes(new Set(allSubThemeIds));
  const handleCollapseAllSubThemes = () => setExpandedSubThemes(new Set());
  const handleExpandAllMainThemes = () =>
    setExpandedMainThemes(new Set(mainThemes.map((mt) => mt.id)));
  const handleCollapseAllMainThemes = () => setExpandedMainThemes(new Set());

  const filteredCodes = useMemo(() => {
    let result = codes;

    // Filter by current reference (only if enabled and referenceId exists)
    if (filterByCurrentReference && referenceId != null) {
      result = result.filter((code) => code.reference === referenceId);
    }

    // Search filter
    if (codesSearch.trim()) {
      const search = codesSearch.toLowerCase();
      result = result.filter(
        (code) =>
          code.name.toLowerCase().includes(search) ||
          code?.comment?.toLowerCase().includes(search)
      );
    }

    return result;
  }, [codes, codesSearch, filterByCurrentReference, referenceId]);

  const filteredSubThemes = useMemo(() => {
    if (!subThemesSearch.trim()) return subThemes;
    const search = subThemesSearch.toLowerCase();
    return subThemes.filter(
      (st) =>
        st.name.toLowerCase().includes(search) ||
        st.description.toLowerCase().includes(search)
    );
  }, [subThemes, subThemesSearch]);

  const filteredMainThemes = useMemo(() => {
    if (!mainThemesSearch.trim()) return mainThemes;
    const search = mainThemesSearch.toLowerCase();
    return mainThemes.filter(
      (mt) =>
        mt.name.toLowerCase().includes(search) ||
        mt.description.toLowerCase().includes(search)
    );
  }, [mainThemes, mainThemesSearch]);

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r bg-background transition-all duration-300',
        isOpen ? 'w-sm overflow-auto' : 'w-0 overflow-hidden'
      )}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Network className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Coding & Theming</h2>
            <p className="text-xs text-muted-foreground">
              Drag items to organise your themes
            </p>
          </div>
        </div>
      </div>

      {/* Highlights list */}
      <ScrollArea className="flex-1">
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* Codes Section */}
          <Collapsible open={codesOpen} onOpenChange={setCodesOpen}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 p-1 h-auto"
                >
                  {codesOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-medium text-sm">Codes</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({codes.length})
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CreateItemDialog
                reviewId={reviewId}
                type="code"
                onCreate={handleCreateCode}
              >
                <Button size="icon" variant="ghost" className="h-6 w-6">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </CreateItemDialog>
            </div>
            <CollapsibleContent className="mt-2 space-y-2">
              <SectionSearch
                value={codesSearch}
                onChange={setCodesSearch}
                placeholder="Search codes..."
                compact
                onExpandAll={handleExpandAllCodes}
                onCollapseAll={handleCollapseAllCodes}
              />
              <div className="flex items-center gap-2 px-1">
                <Checkbox
                  id="filter-current-ref"
                  checked={filterByCurrentReference}
                  onCheckedChange={(checked) =>
                    setFilterByCurrentReference(checked === true)
                  }
                />
                <Label
                  htmlFor="filter-current-ref"
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Filter by current reference
                </Label>
              </div>
              <div className="space-y-2 min-h-[60px] p-2 bg-background/50 rounded-md border border-dashed border-border">
                {filteredCodes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {codesSearch ? 'No matching codes' : 'No codes yet'}
                  </p>
                ) : (
                  filteredCodes.map((code) => (
                    <CodeCard
                      key={code.id}
                      code={code}
                      onEdit={handleEditCode}
                      onDelete={handleDeleteCode}
                      onDragStart={() => handleDragStart('code', code.id)}
                      onDragEnd={handleDragEnd}
                      onJump={handleJumpToCode}
                      compact
                      isExpanded={expandedCodes.has(code.id)}
                      onToggleExpand={handleToggleCode}
                    />
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Sub Themes Section */}
          <Collapsible open={subThemesOpen} onOpenChange={setSubThemesOpen}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 p-1 h-auto"
                >
                  {subThemesOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-medium text-sm">Sub Themes</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({subThemes.length})
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CreateItemDialog
                reviewId={reviewId}
                type="subTheme"
                onCreate={handleCreateSubTheme}
              >
                <Button size="icon" variant="ghost" className="h-6 w-6">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </CreateItemDialog>
            </div>
            <CollapsibleContent className="mt-2 space-y-2">
              <SectionSearch
                value={subThemesSearch}
                onChange={setSubThemesSearch}
                placeholder="Search sub themes..."
                compact
                onExpandAll={handleExpandAllSubThemes}
                onCollapseAll={handleCollapseAllSubThemes}
              />
              <div className="space-y-2 min-h-[60px] p-2 bg-background/50 rounded-md border border-dashed border-border">
                {filteredSubThemes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {subThemesSearch
                      ? 'No matching sub themes'
                      : 'No sub themes yet'}
                  </p>
                ) : (
                  filteredSubThemes.map((subTheme) => (
                    <SubThemeCard
                      key={subTheme.id}
                      subTheme={subTheme}
                      onEdit={handleEditSubTheme}
                      onDelete={handleDeleteSubTheme}
                      onDragStart={() =>
                        handleDragStart('subTheme', subTheme.id)
                      }
                      onDragEnd={handleDragEnd}
                      onDropCode={() => handleDropCodeOnSubTheme(subTheme.id)}
                      onRemoveCode={handleRemoveCodeFromSubTheme}
                      onEditCode={handleEditCode}
                      onDeleteCode={handleDeleteCode}
                      isDraggingCode={draggedItem?.type === 'code'}
                      compact
                      isExpanded={expandedSubThemes.has(subTheme.id)}
                      onToggleExpand={handleToggleSubTheme}
                      onJumpCode={handleJumpToCode}
                      expandedCodes={expandedCodes}
                      onToggleCode={handleToggleCode}
                    />
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Main Themes Section */}
          <Collapsible open={mainThemesOpen} onOpenChange={setMainThemesOpen}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 p-1 h-auto"
                >
                  {mainThemesOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-medium text-sm">Main Themes</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({mainThemes.length})
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CreateItemDialog
                reviewId={reviewId}
                type="mainTheme"
                onCreate={handleCreateMainTheme}
              >
                <Button size="icon" variant="ghost" className="h-6 w-6">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </CreateItemDialog>
            </div>
            <CollapsibleContent className="mt-2 space-y-2">
              <SectionSearch
                value={mainThemesSearch}
                onChange={setMainThemesSearch}
                placeholder="Search main themes..."
                compact
                onExpandAll={handleExpandAllMainThemes}
                onCollapseAll={handleCollapseAllMainThemes}
              />
              <div className="space-y-2 min-h-[60px] p-2 bg-background/50 rounded-md border border-dashed border-border">
                {filteredMainThemes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {mainThemesSearch
                      ? 'No matching main themes'
                      : 'No main themes yet'}
                  </p>
                ) : (
                  filteredMainThemes.map((mainTheme) => (
                    <MainThemeCard
                      key={mainTheme.id}
                      mainTheme={mainTheme}
                      onEdit={handleEditMainTheme}
                      onDelete={handleDeleteMainTheme}
                      onDropSubTheme={() =>
                        handleDropSubThemeOnMainTheme(mainTheme.id)
                      }
                      onRemoveSubTheme={handleRemoveSubThemeFromMainTheme}
                      onEditSubTheme={handleEditSubTheme}
                      onDeleteSubTheme={handleDeleteSubTheme}
                      onDropCode={handleDropCodeOnSubTheme}
                      onRemoveCode={handleRemoveCodeFromSubTheme}
                      onEditCode={handleEditCode}
                      onDeleteCode={handleDeleteCode}
                      isDraggingSubTheme={draggedItem?.type === 'subTheme'}
                      isDraggingCode={draggedItem?.type === 'code'}
                      compact
                      isExpanded={expandedMainThemes.has(mainTheme.id)}
                      onToggleExpand={handleToggleMainTheme}
                      onJumpCode={handleJumpToCode}
                      expandedSubThemes={expandedSubThemes}
                      onToggleSubTheme={handleToggleSubTheme}
                      expandedCodes={expandedCodes}
                      onToggleCode={handleToggleCode}
                    />
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
