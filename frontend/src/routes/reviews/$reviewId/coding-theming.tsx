import { createFileRoute } from '@tanstack/react-router';
import { SubThemeCard } from '@/features/coding/components/sub-themes/sub-theme-card';
import { useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { MainThemeCard } from '@/features/coding/components/main-themes/main-theme-card';
import { CodeCard } from '@/features/coding/components/codes/code-card';
import { CreateItemDialog } from '@/features/coding/components/create-item-dialog';
import { SectionSearch } from '@/features/coding/components/section-search';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { useCodingTheming } from '@/features/coding/hooks/use-coding-theming';
import type { Code } from '@/features/coding/types/codes';
import { PDFDialog } from '@/components/shared/pdf-dialog/pdf-dialog';
import React from 'react';
import { ExportDropdown } from '@/features/coding/components/export-dropdown';
import { useFetchReview } from '@/features/reviews/hooks/use-reviews';
import { can } from '@/lib/permissions';

export const Route = createFileRoute('/reviews/$reviewId/coding-theming')({
  component: RouteComponent,
});

function RouteComponent() {
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);
  const reviewId = Number(Route.useParams()['reviewId']);
  const fetchReview = useFetchReview(reviewId);
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

  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(
    new Set(codes.map((c) => c.id))
  );
  const [expandedSubThemes, setExpandedSubThemes] = useState<Set<number>>(
    new Set(subThemes.map((st) => st.id))
  );
  const [expandedMainThemes, setExpandedMainThemes] = useState<Set<number>>(
    new Set(mainThemes.map((mt) => mt.id))
  );
  const [openPdfDialog, setOpenPdfDialog] = React.useState(false);
  const [selectedCode, setSelectedCode] = useState<Code | null>(null);

  useEffect(() => {
    setPageTitle('Coding & Theming');
    setIsAuthenticated(true);
    setScroll(false);
  }, []);

  const handleJumpToCode = (code: Code) => {
    if (code.reference && code.referenceFileUrl) {
      setSelectedCode(code);
      setOpenPdfDialog(true);
      document.location.hash = `highlight-${code.id}`;
    }
  };

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

  const allCodeIds = useMemo(() => new Set(codes.map((c) => c.id)), [codes]);
  const codesMap = useMemo(() => {
    return Object.fromEntries(codes.map((code) => [code.id, code]));
  }, [codes]);

  const allSubThemeIds = useMemo(
    () => new Set(subThemes.map((st) => st.id)),
    [subThemes]
  );
  const subThemesMap = useMemo(
    () => Object.fromEntries(subThemes.map((st) => [st.id, st])),
    [subThemes]
  );

  const handleExpandAllCodes = () => setExpandedCodes(new Set(allCodeIds));
  const handleCollapseAllCodes = () => setExpandedCodes(new Set());
  const handleExpandAllSubThemes = () =>
    setExpandedSubThemes(new Set(allSubThemeIds));
  const handleCollapseAllSubThemes = () => setExpandedSubThemes(new Set());
  const handleExpandAllMainThemes = () =>
    setExpandedMainThemes(new Set(mainThemes.map((mt) => mt.id)));
  const handleCollapseAllMainThemes = () => setExpandedMainThemes(new Set());

  const filteredCodes = useMemo(() => {
    if (!codesSearch.trim())
      return codes.filter((code) => code.subTheme === null);
    const search = codesSearch.toLowerCase();
    return codes.filter(
      (code) =>
        code.subTheme === null &&
        (code.name.toLowerCase().includes(search) ||
          code?.comment?.includes(search))
    );
  }, [codes, codesSearch]);

  const filteredSubThemes = useMemo(() => {
    if (!subThemesSearch.trim())
      return subThemes.filter((st) => st.mainTheme === null);
    const search = subThemesSearch.toLowerCase();
    return subThemes.filter(
      (st) =>
        st.mainTheme === null &&
        (st.name.toLowerCase().includes(search) ||
          st.description.toLowerCase().includes(search))
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
    <>
      {openPdfDialog &&
        selectedCode &&
        selectedCode.reference &&
        selectedCode.referenceFileUrl && (
          <PDFDialog
            reviewId={reviewId}
            referenceId={selectedCode.reference}
            open={!!openPdfDialog}
            onOpenChange={(open) => !open && setOpenPdfDialog(false)}
            title=""
            fileUrl={selectedCode.referenceFileUrl}
            readOnly={false}
            userRole={fetchReview.data?.userRole || 'Viewer'}
          />
        )}
      <div className="flex w-full justify-end my-4">
        <ExportDropdown reviewId={reviewId} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Codes Column */}
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
                  <span className="text-sm text-muted-foreground">
                    ({codes.length})
                  </span>
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
              <SectionSearch
                value={codesSearch}
                onChange={setCodesSearch}
                placeholder="Search codes..."
                onExpandAll={handleExpandAllCodes}
                onCollapseAll={handleCollapseAllCodes}
              />
              <div className="space-y-3 min-h-[200px] p-4 bg-muted/30 rounded-lg border border-dashed border-border">
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
                      userRole={fetchReview.data?.userRole || 'Viewer'}
                      code={code}
                      onEdit={handleEditCode}
                      onDelete={handleDeleteCode}
                      onDragStart={() => handleDragStart('code', code.id)}
                      onDragEnd={handleDragEnd}
                      onJump={handleJumpToCode}
                      isExpanded={expandedCodes.has(code.id)}
                      onToggleExpand={handleToggleCode}
                    />
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Sub Themes Column */}
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
                  <span className="text-sm text-muted-foreground">
                    ({subThemes.length})
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CreateItemDialog type="subTheme" onCreate={handleCreateSubTheme}>
                {can('modifyThemesCodes', fetchReview.data?.userRole) && (
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Sub Theme
                  </Button>
                )}
              </CreateItemDialog>
            </div>
            <CollapsibleContent className="mt-4 space-y-3">
              <SectionSearch
                value={subThemesSearch}
                onChange={setSubThemesSearch}
                placeholder="Search sub themes..."
                onExpandAll={handleExpandAllSubThemes}
                onCollapseAll={handleCollapseAllSubThemes}
              />
              <div className="space-y-3 min-h-[200px] p-4 bg-muted/30 rounded-lg border border-dashed border-border">
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
                      userRole={fetchReview.data?.userRole || 'Viewer'}
                      subTheme={subTheme}
                      codesMap={codesMap}
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
        </div>

        {/* Main Themes Column */}
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
                  <span className="text-sm text-muted-foreground">
                    ({mainThemes.length})
                  </span>
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
                      userRole={fetchReview.data?.userRole || 'Viewer'}
                      mainTheme={mainTheme}
                      codesMap={codesMap}
                      subThemesMap={subThemesMap}
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
      </div>
    </>
  );
}
