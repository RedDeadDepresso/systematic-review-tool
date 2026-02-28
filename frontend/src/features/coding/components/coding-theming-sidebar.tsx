import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { MainThemeCard } from '@/features/coding/components/main-themes/main-theme-card';
import { SubThemeCard } from '@/features/coding/components/sub-themes/sub-theme-card';
import { CodeCard } from '@/features/coding/components/codes/code-card';
import { CreateItemDialog } from '@/features/coding/components/create-item-dialog';
import { SectionSearch } from '@/features/coding/components/section-search';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, ChevronDown, ChevronRight, Network } from 'lucide-react';
import { useCodingTheming } from '@/features/coding/hooks/use-coding-theming';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Code } from '@/features/coding/types/codes';
import type { SubTheme } from '@/features/coding/types/sub-themes';
import { useFetchReview } from '@/features/reviews/hooks/use-reviews';

interface CodingThemingSidebarProps {
  reviewId: number;
  referenceId?: number;
  isOpen: boolean;
  handleJumpToCode: (code: Code) => void;
}

// ── Droppable flat-list zones ─────────────────────────────────────────────────

function DroppableCodesList({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'codes-list' });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'space-y-2 min-h-[60px] p-2 bg-background/50 rounded-md border border-dashed transition-colors',
        isOver ? 'border-primary bg-primary/10' : 'border-border'
      )}
    >
      {children}
    </div>
  );
}

function DroppableSubThemesList({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'subthemes-list' });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'space-y-2 min-h-[60px] p-2 bg-background/50 rounded-md border border-dashed transition-colors',
        isOver ? 'border-primary bg-primary/10' : 'border-border'
      )}
    >
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
    handleCreateCode,
    handleCreateSubTheme,
    handleCreateMainTheme,
    handleEditCode,
    handleEditSubTheme,
    handleEditMainTheme,
    handleDeleteCode,
    handleDeleteSubTheme,
    handleDeleteMainTheme,
    handleMoveCode,
    handleMoveSubTheme,
  } = useCodingTheming(reviewId);

  const fetchReview = useFetchReview(reviewId);
  const userRole = fetchReview.data?.userRole ?? 'Viewer';

  // ── Section open/search state ─────────────────────────────────────────────
  const [codesOpen, setCodesOpen] = useState(true);
  const [subThemesOpen, setSubThemesOpen] = useState(true);
  const [mainThemesOpen, setMainThemesOpen] = useState(true);

  const [codesSearch, setCodesSearch] = useState('');
  const [subThemesSearch, setSubThemesSearch] = useState('');
  const [mainThemesSearch, setMainThemesSearch] = useState('');

  const [filterByCurrentReference, setFilterByCurrentReference] =
    useState(false);

  // ── Expand/collapse state ─────────────────────────────────────────────────
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(
    new Set(codes.map((c) => c.id))
  );
  const [expandedSubThemes, setExpandedSubThemes] = useState<Set<number>>(
    new Set(subThemes.map((st) => st.id))
  );
  const [expandedMainThemes, setExpandedMainThemes] = useState<Set<number>>(
    new Set(mainThemes.map((mt) => mt.id))
  );

  // ── Drag overlay state ────────────────────────────────────────────────────
  const [activeCode, setActiveCode] = useState<Code | null>(null);
  const [activeSubTheme, setActiveSubTheme] = useState<SubTheme | null>(null);

  // ── dnd-kit sensors ───────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as
      | { type: 'code'; id: string }
      | { type: 'subTheme'; id: number };

    if (data.type === 'code') {
      setActiveCode(codesMap[data.id] ?? null);
    } else if (data.type === 'subTheme') {
      setActiveSubTheme(subThemesMap[data.id] ?? null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCode(null);
    setActiveSubTheme(null);

    if (!over) return;

    const data = active.data.current as
      | { type: 'code'; id: string }
      | { type: 'subTheme'; id: number };
    const overId = over.id as string;

    if (data.type === 'code') {
      if (overId === 'codes-list') {
        handleMoveCode(data.id, null);
      } else if (overId.startsWith('subtheme-')) {
        const subThemeId = Number(overId.replace('subtheme-', ''));
        const code = codesMap[data.id];
        if (code && code.subTheme !== subThemeId) {
          handleMoveCode(data.id, subThemeId);
        }
      }
      return;
    }

    if (data.type === 'subTheme') {
      if (overId === 'subthemes-list') {
        handleMoveSubTheme(data.id, null);
      } else if (overId.startsWith('maintheme-')) {
        const mainThemeId = Number(overId.replace('maintheme-', ''));
        const subTheme = subThemesMap[data.id];
        if (subTheme && subTheme.mainTheme !== mainThemeId) {
          handleMoveSubTheme(data.id, mainThemeId);
        }
      }
    }
  };

  // ── Toggle helpers ────────────────────────────────────────────────────────
  const handleToggleCode = useCallback((id: string) => {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleToggleSubTheme = useCallback((id: number) => {
    setExpandedSubThemes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleToggleMainTheme = useCallback((id: number) => {
    setExpandedMainThemes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Derived maps ──────────────────────────────────────────────────────────
  // group related memoization so the React compiler can preserve it easily
  const { allCodeIds, codesMap } = useMemo(() => {
    const ids = new Set<string>();
    const map: Record<string, Code> = {};

    for (const c of codes) {
      ids.add(c.id);
      map[c.id] = c;
    }

    return { allCodeIds: ids, codesMap: map };
  }, [codes]);

  const { allSubThemeIds, subThemesMap } = useMemo(() => {
    const ids = new Set<number>();
    const map: Record<number, SubTheme> = {};

    for (const st of subThemes) {
      ids.add(st.id);
      map[st.id] = st;
    }

    return { allSubThemeIds: ids, subThemesMap: map };
  }, [subThemes]);

  // ── Expand/collapse all ───────────────────────────────────────────────────
  const handleExpandAllCodes = () => setExpandedCodes(new Set(allCodeIds));
  const handleCollapseAllCodes = () => setExpandedCodes(new Set());
  const handleExpandAllSubThemes = () =>
    setExpandedSubThemes(new Set(allSubThemeIds));
  const handleCollapseAllSubThemes = () => setExpandedSubThemes(new Set());
  const handleExpandAllMainThemes = () =>
    setExpandedMainThemes(new Set(mainThemes.map((mt) => mt.id)));
  const handleCollapseAllMainThemes = () => setExpandedMainThemes(new Set());

  // ── Filtered lists ────────────────────────────────────────────────────────
  const filteredCodes = useMemo(() => {
    let result = codes;
    if (filterByCurrentReference && referenceId != null) {
      result = result.filter((c) => c.reference === referenceId);
    }
    if (codesSearch.trim()) {
      const s = codesSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(s) ||
          c?.comment?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [codes, codesSearch, filterByCurrentReference, referenceId]);

  const filteredSubThemes = useMemo(() => {
    if (!subThemesSearch.trim()) return subThemes;
    const s = subThemesSearch.toLowerCase();
    return subThemes.filter(
      (st) =>
        st.name.toLowerCase().includes(s) ||
        st.description.toLowerCase().includes(s)
    );
  }, [subThemes, subThemesSearch]);

  const filteredMainThemes = useMemo(() => {
    if (!mainThemesSearch.trim()) return mainThemes;
    const s = mainThemesSearch.toLowerCase();
    return mainThemes.filter(
      (mt) =>
        mt.name.toLowerCase().includes(s) ||
        mt.description.toLowerCase().includes(s)
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

      {/* Content */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="flex-1">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* ── Codes Section ── */}
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
                <CreateItemDialog type="code" onCreate={handleCreateCode}>
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
                <DroppableCodesList>
                  {filteredCodes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {codesSearch ? 'No matching codes' : 'No codes yet'}
                    </p>
                  ) : (
                    filteredCodes.map((code) => (
                      <CodeCard
                        key={code.id}
                        userRole={userRole}
                        code={code}
                        onEdit={handleEditCode}
                        onDelete={handleDeleteCode}
                        onJump={handleJumpToCode}
                        compact
                        isExpanded={expandedCodes.has(code.id)}
                        onToggleExpand={handleToggleCode}
                      />
                    ))
                  )}
                </DroppableCodesList>
              </CollapsibleContent>
            </Collapsible>

            {/* ── Sub Themes Section ── */}
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
                <DroppableSubThemesList>
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
                        userRole={userRole}
                        subTheme={subTheme}
                        codesMap={codesMap}
                        onEdit={handleEditSubTheme}
                        onDelete={handleDeleteSubTheme}
                        onRemoveCode={(codeId) => handleMoveCode(codeId, null)}
                        onEditCode={handleEditCode}
                        onDeleteCode={handleDeleteCode}
                        compact
                        isExpanded={expandedSubThemes.has(subTheme.id)}
                        onToggleExpand={handleToggleSubTheme}
                        onJumpCode={handleJumpToCode}
                        expandedCodes={expandedCodes}
                        onToggleCode={handleToggleCode}
                      />
                    ))
                  )}
                </DroppableSubThemesList>
              </CollapsibleContent>
            </Collapsible>

            {/* ── Main Themes Section ── */}
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
                        userRole={userRole}
                        mainTheme={mainTheme}
                        codesMap={codesMap}
                        subThemesMap={subThemesMap}
                        onEdit={handleEditMainTheme}
                        onDelete={handleDeleteMainTheme}
                        onRemoveSubTheme={(subThemeId) =>
                          handleMoveSubTheme(subThemeId, null)
                        }
                        onEditSubTheme={handleEditSubTheme}
                        onDeleteSubTheme={handleDeleteSubTheme}
                        onRemoveCode={(codeId) => handleMoveCode(codeId, null)}
                        onEditCode={handleEditCode}
                        onDeleteCode={handleDeleteCode}
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

        {/* ── Drag overlay ── */}
        <DragOverlay dropAnimation={null}>
          {activeCode && (
            <CodeCard
              userRole={userRole}
              code={activeCode}
              onEdit={() => {}}
              onDelete={() => {}}
              compact
              isExpanded={expandedCodes.has(activeCode.id)}
              onToggleExpand={() => {}}
              isOverlay
            />
          )}
          {activeSubTheme && (
            <SubThemeCard
              userRole={userRole}
              subTheme={activeSubTheme}
              codesMap={codesMap}
              onEdit={() => {}}
              onDelete={() => {}}
              onRemoveCode={() => {}}
              onEditCode={() => {}}
              onDeleteCode={() => {}}
              compact
              isExpanded={expandedSubThemes.has(activeSubTheme.id)}
              onToggleExpand={() => {}}
              expandedCodes={expandedCodes}
              onToggleCode={() => {}}
              isOverlay
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
