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
  FileText,
  Calendar,
  User,
  MoreVertical,
  Book,
  Tag,
  Check,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Keyword } from '@/features/references/types/keywords';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {
  ArticleViewLayout,
  OpinionStatus,
} from '@/features/references/types/references';
import type {
  Assignee,
  FileCounts,
  LabelCount,
  PublicationType,
  PublicationYear,
  SearchMethod,
} from '@/features/references/api/references';
import type { ReviewRole } from '@/features/reviews/types/reviews';
import { can } from '@/lib/permissions';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useLocalStorage, useMediaQuery } from 'usehooks-ts';

interface FiltersSidebarProps {
  reviewId: number;
  userRole: ReviewRole;
  includeKeywords: Keyword[];
  excludeKeywords: Keyword[];
  labels: LabelCount[];
  publicationTypes: PublicationType[];
  publicationYears: PublicationYear[];
  fileCounts: FileCounts;
  assignees: Assignee[];
  searchMethods: SearchMethod[];
  selectedIncludeKeywords: string[];
  selectedExcludeKeywords: string[];
  selectedLabels: number[];
  selectedPublicationTypes: string[];
  selectedPublicationYears: number[];
  selectedFileStatus: 'all' | 'withFile' | 'withoutFile';
  selectedAssignees: (number | null)[];
  selectedSearchMethods: number[];
  selectedOpinionStatuses: OpinionStatus[];
  opinionStatuses: OpinionStatus[];
  onIncludeKeywordToggle: (keyword: string) => void;
  onExcludeKeywordToggle: (keyword: string) => void;
  onSelectAllInclude: () => void;
  onSelectAllExclude: () => void;
  onLabelToggle: (labelId: number) => void;
  onSelectAllLabels: () => void;
  onPublicationTypeToggle: (type: string) => void;
  onSelectAllPublicationTypes: () => void;
  onPublicationYearToggle: (year: number) => void;
  onSelectAllPublicationYears: () => void;
  onFileStatusChange: (status: 'all' | 'withFile' | 'withoutFile') => void;
  onAssigneeToggle: (assigneeId: number | null) => void;
  onSelectAllAssignees: () => void;
  onSearchMethodToggle: (searchMethodId: number) => void;
  onOpionStatusToggle: (opinionStatus: OpinionStatus) => void;
  onSelectAllSearchMethods: () => void;
  onSelectAllOpinionStatuses: () => void;
  onResetAllFilters: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  includeHighlightEnabled: boolean;
  excludeHighlightEnabled: boolean;
  onToggleIncludeHighlight: () => void;
  onToggleExcludeHighlight: () => void;
  onCreateKeyword: (name: string, isInclusive: boolean) => void;
  onDeleteKeyword?: (keyword: Keyword) => void;
  onDeleteLabel?: (label: LabelCount) => void;
  onDeleteSearchMethod?: (searchMethod: SearchMethod) => void;
  articleViewLayout?: ArticleViewLayout;
  onArticleViewLayoutChange?: (layout: ArticleViewLayout) => void;
}

// Reusable collapsible section component
interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  activeCount?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  isOpen,
  onToggle,
  actions,
  activeCount,
  children,
}) => (
  <div className="border-b border-border">
    <div
      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
      onClick={onToggle}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
        {activeCount != null && activeCount > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold h-4 min-w-4 px-1 leading-none">
            {activeCount}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {actions}
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </div>
    {isOpen && <div className="px-4 pb-4">{children}</div>}
  </div>
);

// Reusable checkbox item component
interface CheckboxItemProps {
  label: string | React.ReactNode;
  checked: boolean;
  onCheckedChange: () => void;
  count?: number;
  onDelete?: () => void;
  className?: string;
}

const CheckboxItem: React.FC<CheckboxItemProps> = ({
  label,
  checked,
  onCheckedChange,
  count,
  onDelete,
  className,
}) => (
  <div
    className={cn(
      'flex items-center justify-between py-1.5 hover:bg-muted/50 rounded px-2 -mx-2 group',
      className
    )}
  >
    <label className="flex items-center gap-3 flex-1 cursor-pointer truncate">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      <span className="text-sm truncate">{label}</span>
    </label>
    <div className="flex items-center gap-2">
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  </div>
);

type Section = {
  opinionStatuses: boolean;
  include: boolean;
  exclude: boolean;
  labels: boolean;
  searchMethods: boolean;
  publicationTypes: boolean;
  publicationYears: boolean;
  fileStatus: boolean;
  assignees: boolean;
  layout: boolean;
};

const defaultSections: Section = {
  opinionStatuses: true,
  include: true,
  exclude: true,
  labels: true,
  searchMethods: true,
  publicationTypes: true,
  publicationYears: true,
  fileStatus: true,
  assignees: true,
  layout: true,
};

export function FiltersSidebar({
  reviewId,
  userRole,
  includeKeywords,
  excludeKeywords,
  selectedIncludeKeywords,
  selectedExcludeKeywords,
  labels,
  selectedLabels,
  publicationTypes,
  publicationYears,
  fileCounts,
  assignees,
  searchMethods,
  opinionStatuses = ['Included', 'Maybe', 'Excluded'],
  selectedPublicationTypes,
  selectedPublicationYears,
  selectedFileStatus,
  selectedAssignees,
  selectedSearchMethods,
  selectedOpinionStatuses,
  onIncludeKeywordToggle,
  onExcludeKeywordToggle,
  onSelectAllInclude,
  onSelectAllExclude,
  onLabelToggle,
  onSelectAllLabels,
  onPublicationTypeToggle,
  onSelectAllPublicationTypes,
  onPublicationYearToggle,
  onSelectAllPublicationYears,
  onFileStatusChange,
  onAssigneeToggle,
  onSelectAllAssignees,
  onSearchMethodToggle,
  onSelectAllSearchMethods,
  onSelectAllOpinionStatuses,
  onResetAllFilters,
  isCollapsed,
  includeHighlightEnabled,
  excludeHighlightEnabled,
  onToggleIncludeHighlight,
  onToggleExcludeHighlight,
  onCreateKeyword,
  onDeleteKeyword,
  onDeleteLabel,
  onDeleteSearchMethod,
  onOpionStatusToggle,
  articleViewLayout,
  onArticleViewLayoutChange,
  onToggleCollapse,
}: FiltersSidebarProps) {
  const isSmallScreen = useMediaQuery('(max-width: 1280px)');

  // Create local constants instead of reassigning destructured props
  // to satisfy React Compiler requirements
  const effectiveOnDeleteKeyword = can('modifyKeyword', userRole)
    ? onDeleteKeyword
    : undefined;

  const effectiveOnDeleteSearchMethod = can('uploadFiles', userRole)
    ? onDeleteSearchMethod
    : undefined;

  // PERSISTENT STATE - survives data changes
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize section states from localStorage
  const [sections, setSections] = useLocalStorage<Section>(
    `filtersSidebar_${reviewId}_sections`,
    defaultSections
  );

  const [searchFilter, setSearchFilter] = useLocalStorage<string>(
    `filtersSidebar_${reviewId}_search`,
    ''
  );

  // Save sections to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      `filtersSidebar_${reviewId}_sections`,
      JSON.stringify(sections)
    );
  }, [sections, reviewId]);

  // Save search filter to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`filtersSidebar_${reviewId}_search`, searchFilter);
  }, [searchFilter, reviewId]);

  // Restore scroll position on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !scrollContainerRef.current) return;

    const stored = localStorage.getItem(`filtersSidebar_${reviewId}_scroll`);
    if (stored) {
      scrollContainerRef.current.scrollTop = parseInt(stored, 10);
    }
  }, [reviewId]);

  // Save scroll position on scroll
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      localStorage.setItem(
        `filtersSidebar_${reviewId}_scroll`,
        scrollContainerRef.current.scrollTop.toString()
      );
    }
  };

  // COMPONENT-LOCAL STATE (non-persistent)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showAddIncludeInput, setShowAddIncludeInput] = useState(false);
  const [showAddExcludeInput, setShowAddExcludeInput] = useState(false);
  const [newIncludeKeyword, setNewIncludeKeyword] = useState('');
  const [newExcludeKeyword, setNewExcludeKeyword] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addIncludeInputRef = useRef<HTMLInputElement>(null);
  const addExcludeInputRef = useRef<HTMLInputElement>(null);

  const [deleteConfirmKeyword, setDeleteConfirmKeyword] =
    useState<Keyword | null>(null);
  const [deleteConfirmLabel, setDeleteConfirmLabel] =
    useState<LabelCount | null>(null);
  const [deleteConfirmSearchMethod, setDeleteConfirmSearchMethod] =
    useState<SearchMethod | null>(null);

  const toggleSection = (section: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Filter all sections based on search
  const filterBySearch = <
    T extends { name?: string; publicationType?: string; year?: number },
  >(
    items: T[],
    getName: (item: T) => string
  ): T[] => {
    if (!searchFilter) return items;
    return items.filter((item) =>
      getName(item).toLowerCase().includes(searchFilter.toLowerCase())
    );
  };

  const filteredIncludeKeywords = filterBySearch(
    includeKeywords,
    (k) => k.name
  );
  const filteredExcludeKeywords = filterBySearch(
    excludeKeywords,
    (k) => k.name
  );
  const filteredLabels = filterBySearch(labels, (l) => l.name);
  const filteredSearchMethods = filterBySearch(searchMethods, (sm) => sm.name);
  const filteredPublicationTypes = filterBySearch(
    publicationTypes,
    (pt) => pt.publicationType
  );
  const filteredPublicationYears = publicationYears.filter((py) =>
    py.year.toString().includes(searchFilter)
  );
  const filteredAssignees = assignees.filter((a) => {
    const name = a.firstName || a.lastName || a.email || 'Unassigned';
    return name.toLowerCase().includes(searchFilter.toLowerCase());
  });
  const filteredOpinionStatuses = opinionStatuses.filter((os) => {
    return os.toLowerCase().includes(searchFilter.toLowerCase());
  });

  // Check if all items are selected
  const isAllSelected = (
    items: any[],
    selected: any[],
    getId: (item: any) => any
  ) =>
    items.length > 0 && items.every((item) => selected.includes(getId(item)));

  const allIncludeSelected = isAllSelected(
    includeKeywords,
    selectedIncludeKeywords,
    (k) => k.name
  );
  const allExcludeSelected = isAllSelected(
    excludeKeywords,
    selectedExcludeKeywords,
    (k) => k.name
  );
  const allLabelsSelected = isAllSelected(labels, selectedLabels, (l) => l.id);
  const allSearchMethodsSelected = isAllSelected(
    searchMethods,
    selectedSearchMethods,
    (sm) => sm.id
  );
  const allPublicationTypesSelected = isAllSelected(
    publicationTypes,
    selectedPublicationTypes,
    (pt) => pt.publicationType
  );
  const allPublicationYearsSelected = isAllSelected(
    publicationYears,
    selectedPublicationYears,
    (py) => py.year
  );
  const allAssigneesSelected = isAllSelected(
    assignees,
    selectedAssignees,
    (a) => a.assignee__id
  );
  const allOpinionStatusesSelected =
    selectedOpinionStatuses.length === opinionStatuses.length;

  const handleExpandAll = () => {
    setSections({
      opinionStatuses: true,
      include: true,
      exclude: true,
      labels: true,
      searchMethods: true,
      publicationTypes: true,
      publicationYears: true,
      fileStatus: true,
      assignees: true,
      layout: true,
    });
  };

  const handleCollapseAll = () => {
    setSections({
      opinionStatuses: false,
      include: false,
      exclude: false,
      labels: false,
      searchMethods: false,
      publicationTypes: false,
      publicationYears: false,
      fileStatus: false,
      assignees: false,
      layout: false,
    });
  };

  const handleReset = () => {
    onResetAllFilters();
    setSearchFilter('');
  };

  // Check if sections should be visible based on search filter
  const hasFilteredContent = {
    opinionStatuses: filteredOpinionStatuses.length > 0,
    include: filteredIncludeKeywords.length > 0 || !searchFilter,
    exclude: filteredExcludeKeywords.length > 0 || !searchFilter,
    labels: filteredLabels.length > 0,
    searchMethods: filteredSearchMethods.length > 0,
    publicationTypes: filteredPublicationTypes.length > 0,
    publicationYears: filteredPublicationYears.length > 0,
    fileStatus: true,
    assignees: filteredAssignees.length > 0,
    layout: true,
  };

  const activeCounts = {
    opinionStatuses: selectedOpinionStatuses.length,
    include: selectedIncludeKeywords.length,
    exclude: selectedExcludeKeywords.length,
    labels: selectedLabels.length,
    searchMethods: selectedSearchMethods.length,
    publicationTypes: selectedPublicationTypes.length,
    publicationYears: selectedPublicationYears.length,
    fileStatus: selectedFileStatus !== 'all' ? 1 : 0,
    assignees: selectedAssignees.length,
  };

  useEffect(() => {
    if (isSmallScreen) onArticleViewLayoutChange?.('title-only');
  }, [isSmallScreen]);

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

  const handleAddKeyword = (
    keyword: string,
    isInclusive: boolean,
    setShow: (show: boolean) => void,
    setKeyword: (keyword: string) => void
  ) => {
    if (keyword.trim()) {
      onCreateKeyword(keyword.trim(), isInclusive);
      setKeyword('');
      setShow(false);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    keyword: string,
    isInclusive: boolean,
    setShow: (show: boolean) => void,
    setKeyword: (keyword: string) => void
  ) => {
    if (e.key === 'Enter') {
      handleAddKeyword(keyword, isInclusive, setShow, setKeyword);
    } else if (e.key === 'Escape') {
      setKeyword('');
      setShow(false);
    }
  };

  if (isCollapsed) return null;

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {isSearchOpen ? (
          <div className="flex items-center gap-2 flex-1 animate-in slide-in-from-right-4 duration-200">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search filters..."
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExpandAll}>
                    Expand All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCollapseAll}>
                    Collapse All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleReset}>
                    Reset Filters
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {/* Opinion Statuses */}
        {opinionStatuses.length > 0 && (
          <CollapsibleSection
            title="Opinion Status"
            icon={<Check className="w-4 h-4 text-muted-foreground" />}
            isOpen={sections.opinionStatuses ?? true}
            onToggle={() =>
              setSections((prev) => ({
                ...prev,
                opinionStatuses: !prev.opinionStatuses,
              }))
            }
            activeCount={activeCounts.opinionStatuses}
          >
            <div className="space-y-1">
              <CheckboxItem
                label={
                  <span className="text-muted-foreground">Select All</span>
                }
                checked={allOpinionStatusesSelected}
                onCheckedChange={onSelectAllOpinionStatuses}
              />
              {opinionStatuses.map((status) => (
                <CheckboxItem
                  key={status}
                  label={status}
                  checked={selectedOpinionStatuses.includes(status)}
                  onCheckedChange={() => onOpionStatusToggle(status)}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Keywords to Include */}
        {hasFilteredContent.include && (
          <CollapsibleSection
            title="Keywords for include"
            icon={
              <div className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-white" />
              </div>
            }
            isOpen={sections.include}
            onToggle={() => toggleSection('include')}
            activeCount={activeCounts.include}
            actions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-6 w-6 p-0 transition-colors',
                    includeHighlightEnabled
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20'
                      : 'hover:bg-muted'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleIncludeHighlight();
                  }}
                  title={
                    includeHighlightEnabled
                      ? 'Disable highlighting'
                      : 'Enable highlighting'
                  }
                >
                  <Check
                    className={cn(
                      'h-3 w-3',
                      includeHighlightEnabled
                        ? 'text-emerald-600'
                        : 'text-muted-foreground'
                    )}
                  />
                </Button>
                {can('modifyKeyword', userRole) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddIncludeInput(!showAddIncludeInput);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </>
            }
          >
            {showAddIncludeInput && (
              <div className="mb-3 animate-in slide-in-from-top-2 duration-200">
                <Input
                  ref={addIncludeInputRef}
                  placeholder="Enter keyword and press Enter"
                  value={newIncludeKeyword}
                  onChange={(e) => setNewIncludeKeyword(e.target.value)}
                  onKeyDown={(e) =>
                    handleKeyDown(
                      e,
                      newIncludeKeyword,
                      true,
                      setShowAddIncludeInput,
                      setNewIncludeKeyword
                    )
                  }
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
              <CheckboxItem
                label={
                  <span className="text-muted-foreground">Select All</span>
                }
                checked={allIncludeSelected}
                onCheckedChange={onSelectAllInclude}
              />
              {filteredIncludeKeywords.map((keyword) => (
                <CheckboxItem
                  key={keyword.name}
                  label={keyword.name}
                  checked={selectedIncludeKeywords.includes(keyword.name)}
                  onCheckedChange={() => onIncludeKeywordToggle(keyword.name)}
                  onDelete={
                    effectiveOnDeleteKeyword
                      ? () => setDeleteConfirmKeyword(keyword)
                      : undefined
                  }
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Keywords to Exclude */}
        {hasFilteredContent.exclude && (
          <CollapsibleSection
            title="Keywords for exclude"
            icon={
              <div className="w-4 h-4 rounded bg-destructive flex items-center justify-center">
                <X className="h-2.5 w-2.5 text-white" />
              </div>
            }
            isOpen={sections.exclude}
            onToggle={() => toggleSection('exclude')}
            activeCount={activeCounts.exclude}
            actions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-6 w-6 p-0 transition-colors',
                    excludeHighlightEnabled
                      ? 'bg-destructive/10 hover:bg-destructive/20'
                      : 'hover:bg-muted'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExcludeHighlight();
                  }}
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
                {can('modifyKeyword', userRole) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddExcludeInput(!showAddExcludeInput);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </>
            }
          >
            {showAddExcludeInput && (
              <div className="mb-3 animate-in slide-in-from-top-2 duration-200">
                <Input
                  ref={addExcludeInputRef}
                  placeholder="Enter keyword and press Enter"
                  value={newExcludeKeyword}
                  onChange={(e) => setNewExcludeKeyword(e.target.value)}
                  onKeyDown={(e) =>
                    handleKeyDown(
                      e,
                      newExcludeKeyword,
                      false,
                      setShowAddExcludeInput,
                      setNewExcludeKeyword
                    )
                  }
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
              <CheckboxItem
                label={
                  <span className="text-muted-foreground">Select All</span>
                }
                checked={allExcludeSelected}
                onCheckedChange={onSelectAllExclude}
              />
              {filteredExcludeKeywords.map((keyword) => (
                <CheckboxItem
                  key={keyword.name}
                  label={keyword.name}
                  checked={selectedExcludeKeywords.includes(keyword.name)}
                  onCheckedChange={() => onExcludeKeywordToggle(keyword.name)}
                  onDelete={
                    effectiveOnDeleteKeyword
                      ? () => setDeleteConfirmKeyword(keyword)
                      : undefined
                  }
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Labels */}
        {hasFilteredContent.labels && (
          <CollapsibleSection
            title="Labels"
            icon={<Tag className="w-4 h-4 text-muted-foreground" />}
            isOpen={sections.labels}
            onToggle={() => toggleSection('labels')}
            activeCount={activeCounts.labels}
          >
            <div className="space-y-1">
              <CheckboxItem
                label={
                  <span className="text-muted-foreground">Select All</span>
                }
                checked={allLabelsSelected}
                onCheckedChange={onSelectAllLabels}
              />
              {filteredLabels.map((label) => (
                <CheckboxItem
                  key={label.id}
                  label={label.name}
                  checked={selectedLabels.includes(label.id)}
                  onCheckedChange={() => onLabelToggle(label.id)}
                  count={label.count}
                  onDelete={
                    onDeleteLabel
                      ? () => setDeleteConfirmLabel(label)
                      : undefined
                  }
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Search Methods */}
        {searchMethods.length > 0 && hasFilteredContent.searchMethods && (
          <CollapsibleSection
            title="Search Method"
            icon={<Search className="w-4 h-4 text-muted-foreground" />}
            isOpen={sections.searchMethods}
            onToggle={() => toggleSection('searchMethods')}
            activeCount={activeCounts.searchMethods}
          >
            <div className="space-y-1">
              <CheckboxItem
                label={
                  <span className="text-muted-foreground">Select All</span>
                }
                checked={allSearchMethodsSelected}
                onCheckedChange={onSelectAllSearchMethods}
              />
              {filteredSearchMethods.map((sm) => (
                <CheckboxItem
                  key={sm.id}
                  label={sm.name}
                  checked={selectedSearchMethods.includes(sm.id)}
                  onCheckedChange={() => onSearchMethodToggle(sm.id)}
                  count={sm.count}
                  onDelete={
                    effectiveOnDeleteSearchMethod
                      ? () => setDeleteConfirmSearchMethod(sm)
                      : undefined
                  }
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Publication Types */}
        {publicationTypes.length > 0 && hasFilteredContent.publicationTypes && (
          <CollapsibleSection
            title="Publication Type"
            icon={<Book className="w-4 h-4 text-muted-foreground" />}
            isOpen={sections.publicationTypes}
            onToggle={() => toggleSection('publicationTypes')}
            activeCount={activeCounts.publicationTypes}
          >
            <div className="space-y-1">
              <CheckboxItem
                label={
                  <span className="text-muted-foreground">Select All</span>
                }
                checked={allPublicationTypesSelected}
                onCheckedChange={onSelectAllPublicationTypes}
              />
              {filteredPublicationTypes.map((pt) => (
                <CheckboxItem
                  key={pt.publicationType}
                  label={pt.publicationType}
                  checked={selectedPublicationTypes.includes(
                    pt.publicationType
                  )}
                  onCheckedChange={() =>
                    onPublicationTypeToggle(pt.publicationType)
                  }
                  count={pt.count}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Publication Years */}
        {publicationYears.length > 0 && hasFilteredContent.publicationYears && (
          <CollapsibleSection
            title="Publication Year"
            icon={<Calendar className="w-4 h-4 text-muted-foreground" />}
            isOpen={sections.publicationYears}
            onToggle={() => toggleSection('publicationYears')}
            activeCount={activeCounts.publicationYears}
          >
            <div className="space-y-1">
              <CheckboxItem
                label={
                  <span className="text-muted-foreground">Select All</span>
                }
                checked={allPublicationYearsSelected}
                onCheckedChange={onSelectAllPublicationYears}
              />
              {filteredPublicationYears.map((py) => (
                <CheckboxItem
                  key={py.year}
                  label={py.year.toString()}
                  checked={selectedPublicationYears.includes(py.year)}
                  onCheckedChange={() => onPublicationYearToggle(py.year)}
                  count={py.count}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* File Status */}
        {hasFilteredContent.fileStatus && (
          <CollapsibleSection
            title="File Status"
            icon={<FileText className="w-4 h-4 text-muted-foreground" />}
            isOpen={sections.fileStatus}
            onToggle={() => toggleSection('fileStatus')}
            activeCount={activeCounts.fileStatus}
          >
            <div className="space-y-1">
              <CheckboxItem
                label="All"
                checked={selectedFileStatus === 'all'}
                onCheckedChange={() => onFileStatusChange('all')}
                count={fileCounts.withFile + fileCounts.withoutFile}
              />
              <CheckboxItem
                label="With File"
                checked={selectedFileStatus === 'withFile'}
                onCheckedChange={() => onFileStatusChange('withFile')}
                count={fileCounts.withFile}
              />
              <CheckboxItem
                label="Without File"
                checked={selectedFileStatus === 'withoutFile'}
                onCheckedChange={() => onFileStatusChange('withoutFile')}
                count={fileCounts.withoutFile}
              />
            </div>
          </CollapsibleSection>
        )}

        {/* Assignees */}
        {assignees.length > 0 && hasFilteredContent.assignees && (
          <CollapsibleSection
            title="Assignee"
            icon={<User className="w-4 h-4 text-muted-foreground" />}
            isOpen={sections.assignees}
            onToggle={() => toggleSection('assignees')}
            activeCount={activeCounts.assignees}
          >
            <div className="space-y-1">
              <CheckboxItem
                label={
                  <span className="text-muted-foreground">Select All</span>
                }
                checked={allAssigneesSelected}
                onCheckedChange={onSelectAllAssignees}
              />
              {filteredAssignees.map((assignee) => (
                <CheckboxItem
                  key={assignee.Id ?? 'unassigned'}
                  label={
                    assignee.Id
                      ? `${assignee.firstName} ${assignee.lastName} (${assignee.email})`
                      : 'Unassigned'
                  }
                  checked={selectedAssignees.includes(assignee.Id)}
                  onCheckedChange={() => onAssigneeToggle(assignee.Id)}
                  count={assignee.count}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Articles Layout */}
        {hasFilteredContent.layout && (
          <CollapsibleSection
            title="Articles Layout"
            icon={<LayoutList className="w-4 h-4 text-muted-foreground" />}
            isOpen={sections.layout}
            onToggle={() => toggleSection('layout')}
          >
            <div className="space-y-1">
              <label
                aria-disabled={isSmallScreen}
                className={cn(
                  'flex items-center gap-3 py-1.5 rounded px-2 -mx-2',
                  isSmallScreen
                    ? 'opacity-50 cursor-not-allowed pointer-events-none'
                    : 'cursor-pointer hover:bg-muted/50'
                )}
                onClick={() => {
                  if (isSmallScreen) return;
                  onArticleViewLayoutChange?.('title-abstract');
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
                onClick={() => onArticleViewLayoutChange?.('title-only')}
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
              <label
                aria-disabled={isSmallScreen}
                className={cn(
                  'flex items-center gap-3 py-1.5 rounded px-2 -mx-2',
                  isSmallScreen
                    ? 'opacity-50 cursor-not-allowed pointer-events-none'
                    : 'cursor-pointer hover:bg-muted/50'
                )}
                onClick={() => {
                  if (isSmallScreen) return;
                  onArticleViewLayoutChange?.('title-file');
                }}
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                    articleViewLayout === 'title-file'
                      ? 'border-primary'
                      : 'border-muted-foreground'
                  )}
                >
                  {articleViewLayout === 'title-file' && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-sm">Title & File view</span>
              </label>
            </div>
          </CollapsibleSection>
        )}
      </div>

      {/* Delete Confirmation Dialogs */}
      <AlertDialog
        open={deleteConfirmKeyword !== null}
        onOpenChange={(open) => !open && setDeleteConfirmKeyword(null)}
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
                if (deleteConfirmKeyword && effectiveOnDeleteKeyword) {
                  effectiveOnDeleteKeyword(deleteConfirmKeyword);
                  setDeleteConfirmKeyword(null);
                }
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteConfirmLabel !== null}
        onOpenChange={(open) => !open && setDeleteConfirmLabel(null)}
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
                if (deleteConfirmLabel && onDeleteLabel) {
                  onDeleteLabel(deleteConfirmLabel);
                  setDeleteConfirmLabel(null);
                }
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteConfirmSearchMethod !== null}
        onOpenChange={(open) => !open && setDeleteConfirmSearchMethod(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Search Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the search method "
              {deleteConfirmSearchMethod?.name}"? This will also delete all
              associated references and their metadata. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (
                  deleteConfirmSearchMethod &&
                  effectiveOnDeleteSearchMethod
                ) {
                  effectiveOnDeleteSearchMethod(deleteConfirmSearchMethod);
                  setDeleteConfirmSearchMethod(null);
                }
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (isSmallScreen) {
    return (
      <Drawer
        open={!isCollapsed}
        onOpenChange={(o) => !o && onToggleCollapse()}
      >
        <DrawerContent className="h-[85vh] flex flex-col">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Filters</DrawerTitle>
          </DrawerHeader>
          {sidebarContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <aside className="w-64 sm:w-72 border-l border-border bg-card flex flex-col h-full">
      {sidebarContent}
    </aside>
  );
}
