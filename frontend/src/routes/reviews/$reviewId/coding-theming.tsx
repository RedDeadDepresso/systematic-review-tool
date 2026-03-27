// Coding and theming page.
import { createFileRoute } from '@tanstack/react-router';
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
import { SubThemeCard } from '@/features/coding/components/sub-themes/sub-theme-card';
import { useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { MainThemeCard } from '@/features/coding/components/main-themes/main-theme-card';
import { CodeCard } from '@/features/coding/components/codes/code-card';
import { CreateItemDialog } from '@/features/coding/components/create-item-dialog';
import { SectionSearch } from '@/features/coding/components/section-search';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { useCodingTheming } from '@/features/coding/hooks/use-coding-theming';
import type { Code } from '@/features/coding/types/codes';
import type { SubTheme } from '@/features/coding/types/sub-themes';
import { PDFDialog } from '@/components/blocks/pdf-dialog/pdf-dialog';
import React from 'react';
import { ExportDropdown } from '@/features/coding/components/export-dropdown';
import { useFetchReview } from '@/features/reviews/hooks/use-reviews';
import { can } from '@/lib/permissions';

export const Route = createFileRoute('/reviews/$reviewId/coding-theming')({
  component: RouteComponent,
});

// ── Skeleton helpers ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card className="bg-card">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start gap-2">
          <Skeleton className="h-5 w-5 shrink-0 rounded" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <div className="flex gap-1 shrink-0">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

function SkeletonColumn({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 min-h-[200px] p-4 bg-muted/30 rounded-lg border border-dashed border-border">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ── Droppable flat-list zones ─────────────────────────────────────────────────
// These allow dragging items back OUT of containers into the flat lists.

function DroppableCodesList({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'codes-list' });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-3 min-h-[200px] p-4 bg-muted/30 rounded-lg border border-dashed transition-colors ${
        isOver ? 'border-primary bg-primary/10' : 'border-border'
      }`}
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
      className={`space-y-3 min-h-[200px] p-4 bg-muted/30 rounded-lg border border-dashed transition-colors ${
        isOver ? 'border-primary bg-primary/10' : 'border-border'
      }`}
    >
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function RouteComponent() {
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);
  const reviewId = Number(Route.useParams()['reviewId']);
  const fetchReview = useFetchReview(reviewId);

  const {
    codes,
    subThemes,
    mainThemes,
    isCodesLoading,
    isSubThemesLoading,
    isMainThemesLoading,
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

  // ── Section open/search state ─────────────────────────────────────────────
  const [codesOpen, setCodesOpen] = useState(true);
  const [subThemesOpen, setSubThemesOpen] = useState(true);
  const [mainThemesOpen, setMainThemesOpen] = useState(true);

  const [codesSearch, setCodesSearch] = useState('');
  const [subThemesSearch, setSubThemesSearch] = useState('');
  const [mainThemesSearch, setMainThemesSearch] = useState('');

  // ── Expand / collapse state ───────────────────────────────────────────────
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(
    new Set(codes.map((c) => c.id))
  );
  const [expandedSubThemes, setExpandedSubThemes] = useState<Set<number>>(
    new Set(subThemes.map((st) => st.id))
  );
  const [expandedMainThemes, setExpandedMainThemes] = useState<Set<number>>(
    new Set(mainThemes.map((mt) => mt.id))
  );

  // ── PDF dialog state ──────────────────────────────────────────────────────
  const [openPdfDialog, setOpenPdfDialog] = React.useState(false);
  const [selectedCode, setSelectedCode] = useState<Code | null>(null);
  const [pendingHighlightId, setPendingHighlightId] = useState<string | null>(
    null
  );

  // ── Drag overlay state ────────────────────────────────────────────────────
  const [activeCode, setActiveCode] = useState<Code | null>(null);
  const [activeSubTheme, setActiveSubTheme] = useState<SubTheme | null>(null);

  useEffect(() => {
    setPageTitle('Coding & Theming');
    setIsAuthenticated(true);
    setScroll(true);
  }, []);

  // ── dnd-kit sensors ──────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require 8px movement before a drag starts, so clicks still work
      activationConstraint: { distance: 8 },
    })
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

    // ── Code drop routing ────────────────────────────────────────────────
    if (data.type === 'code') {
      if (overId === 'codes-list') {
        // Dropped onto flat codes list → remove from sub-theme
        handleMoveCode(data.id, null);
      } else if (overId.startsWith('subtheme-')) {
        const subThemeId = Number(overId.replace('subtheme-', ''));
        const code = codesMap[data.id];
        // Only mutate if actually moving to a different sub-theme
        if (code && code.subTheme !== subThemeId) {
          handleMoveCode(data.id, subThemeId);
        }
      }
      return;
    }

    // ── SubTheme drop routing ─────────────────────────────────────────────
    if (data.type === 'subTheme') {
      if (overId === 'subthemes-list') {
        // Dropped onto flat sub-themes list → remove from main-theme
        handleMoveSubTheme(data.id, null);
      } else if (overId.startsWith('maintheme-')) {
        const mainThemeId = Number(overId.replace('maintheme-', ''));
        const subTheme = subThemesMap[data.id];
        // Only mutate if actually moving to a different main-theme
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

  // ── Filtered lists (flat sections only show unassigned items) ─────────────
  const filteredCodes = useMemo(() => {
    const unassigned = codes.filter((c) => c.subTheme === null);
    if (!codesSearch.trim()) return unassigned;
    const s = codesSearch.toLowerCase();
    return unassigned.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c?.comment?.toLowerCase().includes(s)
    );
  }, [codes, codesSearch]);

  const filteredSubThemes = useMemo(() => {
    const unassigned = subThemes.filter((st) => st.mainTheme === null);
    if (!subThemesSearch.trim()) return unassigned;
    const s = subThemesSearch.toLowerCase();
    return unassigned.filter(
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

  // ── PDF jump ──────────────────────────────────────────────────────────────
  const handleJumpToCode = (code: Code) => {
    if (code.reference && code.referenceFileUrl) {
      setSelectedCode(code);
      setPendingHighlightId(code.id.toString());
      setOpenPdfDialog(true);
    }
  };

  const userRole = fetchReview.data?.userRole ?? 'viewer';

  // ── Shared props passed to every SubThemeCard ─────────────────────────────
  const subThemeCardSharedProps = {
    userRole,
    codesMap,
    onEdit: handleEditSubTheme,
    onDelete: handleDeleteSubTheme,
    onRemoveCode: (codeId: string) => handleMoveCode(codeId, null),
    onEditCode: handleEditCode,
    onDeleteCode: handleDeleteCode,
    onJumpCode: handleJumpToCode,
    expandedCodes,
    onToggleCode: handleToggleCode,
  } as const;

  return (
    <>
      {openPdfDialog &&
        selectedCode?.reference &&
        selectedCode?.referenceFileUrl && (
          <PDFDialog
            reviewId={reviewId}
            referenceId={selectedCode.reference}
            open={!!openPdfDialog}
            onOpenChange={(open) => !open && setOpenPdfDialog(false)}
            title={selectedCode?.referenceTitle || ''}
            fileUrl={selectedCode.referenceFileUrl}
            readOnly={false}
            userRole={userRole}
            hasNext={false}
            hasPrev={false}
            onNavigate={(_val: 'prev' | 'next') => {}}
            pendingHighlightId={pendingHighlightId}
            onPendingHighlightConsumed={() => setPendingHighlightId(null)}
          />
        )}

      <div className="flex items-center justify-end px-4 sm:px-6 py-3 border-border bg-card">
        <div className="flex items-center gap-2">
          <ExportDropdown reviewId={reviewId} />
        </div>
      </div>

      {/* ── All drag-and-drop lives inside one DndContext ── */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Codes Column ── */}
          <div className="space-y-4">
            <Collapsible open={codesOpen} onOpenChange={setCodesOpen}>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 p-1 h-auto"
                  >
                    {codesOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <h2 className="text-xl font-semibold text-foreground">
                      Codes
                    </h2>
                    {!isCodesLoading && (
                      <span className="text-sm text-muted-foreground">
                        ({codes.length})
                      </span>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CreateItemDialog type="code" onCreate={handleCreateCode}>
                  {can('modifyThemesCodes', fetchReview.data?.userRole) && (
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Code
                    </Button>
                  )}
                </CreateItemDialog>
              </div>

              <CollapsibleContent className="mt-4 space-y-3">
                {isCodesLoading ? (
                  <SkeletonColumn count={3} />
                ) : (
                  <>
                    <SectionSearch
                      value={codesSearch}
                      onChange={setCodesSearch}
                      placeholder="Search codes..."
                      onExpandAll={handleExpandAllCodes}
                      onCollapseAll={handleCollapseAllCodes}
                    />
                    {/* Droppable zone – codes dragged out of sub-themes land here */}
                    <DroppableCodesList>
                      {filteredCodes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          {codesSearch
                            ? 'No matching codes'
                            : 'No codes yet. Create one to get started.'}
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
                            isExpanded={expandedCodes.has(code.id)}
                            onToggleExpand={handleToggleCode}
                          />
                        ))
                      )}
                    </DroppableCodesList>
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* ── Sub Themes Column ── */}
          <div className="space-y-4">
            <Collapsible open={subThemesOpen} onOpenChange={setSubThemesOpen}>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 p-1 h-auto"
                  >
                    {subThemesOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <h2 className="text-xl font-semibold text-foreground">
                      Sub Themes
                    </h2>
                    {!isSubThemesLoading && (
                      <span className="text-sm text-muted-foreground">
                        ({subThemes.length})
                      </span>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CreateItemDialog
                  type="subTheme"
                  onCreate={handleCreateSubTheme}
                >
                  {can('modifyThemesCodes', fetchReview.data?.userRole) && (
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Sub Theme
                    </Button>
                  )}
                </CreateItemDialog>
              </div>

              <CollapsibleContent className="mt-4 space-y-3">
                {isSubThemesLoading ? (
                  <SkeletonColumn count={3} />
                ) : (
                  <>
                    <SectionSearch
                      value={subThemesSearch}
                      onChange={setSubThemesSearch}
                      placeholder="Search sub themes..."
                      onExpandAll={handleExpandAllSubThemes}
                      onCollapseAll={handleCollapseAllSubThemes}
                    />
                    {/* Droppable zone – sub-themes dragged out of main-themes land here */}
                    <DroppableSubThemesList>
                      {filteredSubThemes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          {subThemesSearch
                            ? 'No matching sub themes'
                            : 'No sub themes yet. Create one to get started.'}
                        </p>
                      ) : (
                        filteredSubThemes.map((subTheme) => (
                          <SubThemeCard
                            key={subTheme.id}
                            {...subThemeCardSharedProps}
                            subTheme={subTheme}
                            isExpanded={expandedSubThemes.has(subTheme.id)}
                            onToggleExpand={handleToggleSubTheme}
                          />
                        ))
                      )}
                    </DroppableSubThemesList>
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* ── Main Themes Column ── */}
          <div className="space-y-4">
            <Collapsible open={mainThemesOpen} onOpenChange={setMainThemesOpen}>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 p-1 h-auto"
                  >
                    {mainThemesOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <h2 className="text-xl font-semibold text-foreground">
                      Main Themes
                    </h2>
                    {!isMainThemesLoading && (
                      <span className="text-sm text-muted-foreground">
                        ({mainThemes.length})
                      </span>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CreateItemDialog
                  type="mainTheme"
                  onCreate={handleCreateMainTheme}
                >
                  {can('modifyThemesCodes', fetchReview.data?.userRole) && (
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Main Theme
                    </Button>
                  )}
                </CreateItemDialog>
              </div>

              <CollapsibleContent className="mt-4 space-y-3">
                {isMainThemesLoading ? (
                  <SkeletonColumn count={3} />
                ) : (
                  <>
                    <SectionSearch
                      value={mainThemesSearch}
                      onChange={setMainThemesSearch}
                      placeholder="Search main themes..."
                      onExpandAll={handleExpandAllMainThemes}
                      onCollapseAll={handleCollapseAllMainThemes}
                    />
                    <div className="space-y-3 min-h-[200px] p-4 bg-muted/30 rounded-lg border border-dashed border-border">
                      {filteredMainThemes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          {mainThemesSearch
                            ? 'No matching main themes'
                            : 'No main themes yet. Create one to get started.'}
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
                            onRemoveCode={(codeId) =>
                              handleMoveCode(codeId, null)
                            }
                            onEditCode={handleEditCode}
                            onDeleteCode={handleDeleteCode}
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
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* ── Drag overlay – renders a ghost of what's being dragged ── */}
        <DragOverlay dropAnimation={null}>
          {activeCode && (
            <CodeCard
              userRole={userRole}
              code={activeCode}
              onEdit={() => {}}
              onDelete={() => {}}
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
              isExpanded={expandedSubThemes.has(activeSubTheme.id)}
              onToggleExpand={() => {}}
              expandedCodes={expandedCodes}
              onToggleCode={() => {}}
              isOverlay
            />
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}
