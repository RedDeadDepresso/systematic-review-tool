import { useMemo, useState } from 'react';
import type { Highlight, HighlightType } from 'react-pdf-highlighter-plus';
import { type CommentedHighlight } from '@/types/code';
import {
  HighlightFilters,
  type SortOption,
} from '@/components/review-full-text-screening/highlight-filters';
import { HighlightCard } from '@/components/review-full-text-screening/highlight-card';
import { PageGroup } from '@/components/review-full-text-screening/page-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  highlights: Array<CommentedHighlight>;
  scrolledToHighlightId: string | null;
  onEditHighlight: (highlight: CommentedHighlight) => void;
  onDeleteHighlight: (highlight: CommentedHighlight) => void;
  isOpen: boolean;
}

const updateHash = (highlight: Highlight) => {
  document.location.hash = `highlight-${highlight.id}`;
};

const HighLightSidebar = ({
  highlights,
  scrolledToHighlightId,
  onEditHighlight,
  onDeleteHighlight,
  isOpen,
}: SidebarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<HighlightType[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('page');

  // Filter and sort highlights
  const filteredHighlights = useMemo(() => {
    let result = [...highlights];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (h) =>
          h.content?.text?.toLowerCase().includes(query) ||
          h.comment?.toLowerCase().includes(query)
      );
    }

    // Apply type filters
    if (activeFilters.length > 0) {
      result = result.filter((h) => {
        const type = h.type || 'area';
        return activeFilters.includes(type);
      });
    }

    // Apply sorting
    switch (sortBy) {
      case 'page':
        result.sort(
          (a, b) =>
            a.position.boundingRect.pageNumber -
            b.position.boundingRect.pageNumber
        );
        break;
      case 'newest':
        // Reverse order (assuming highlights are added in order)
        result.reverse();
        break;
      case 'type':
        result.sort((a, b) => {
          const typeA = a.type || 'area';
          const typeB = b.type || 'area';
          return typeA.localeCompare(typeB);
        });
        break;
    }

    return result;
  }, [highlights, searchQuery, activeFilters, sortBy]);

  // Group highlights by page
  const highlightsByPage = useMemo(() => {
    const groups: Record<number, CommentedHighlight[]> = {};
    filteredHighlights.forEach((highlight) => {
      const page = highlight.position.boundingRect.pageNumber;
      if (!groups[page]) {
        groups[page] = [];
      }
      groups[page].push(highlight);
    });
    return groups;
  }, [filteredHighlights]);

  const pageNumbers = Object.keys(highlightsByPage)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r bg-background transition-all duration-300',
        isOpen ? 'w-80 overflow-auto' : 'w-0 overflow-hidden'
      )}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Highlights</h2>
            <p className="text-xs text-muted-foreground">
              {highlights.length} annotation{highlights.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 border-b p-4">
        <HighlightFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      </div>

      {/* Highlights list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {pageNumbers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="mb-2 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {highlights.length === 0
                  ? 'No highlights yet'
                  : 'No matching highlights'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {highlights.length === 0
                  ? 'Select text or hold Alt to create area highlights'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : sortBy === 'page' ? (
            // Grouped by page view
            pageNumbers.map((pageNumber) => (
              <PageGroup
                key={pageNumber}
                pageNumber={pageNumber}
                highlightCount={highlightsByPage[pageNumber].length}
              >
                {highlightsByPage[pageNumber].map((highlight) => (
                  <HighlightCard
                    key={highlight.id}
                    highlight={highlight}
                    isScrolledTo={scrolledToHighlightId === highlight.id}
                    onClick={() => updateHash(highlight)}
                    onEdit={() => onEditHighlight(highlight)}
                    onDelete={() => onDeleteHighlight(highlight)}
                  />
                ))}
              </PageGroup>
            ))
          ) : (
            // Flat list view
            <div className="space-y-2 p-2">
              {filteredHighlights.map((highlight) => (
                <HighlightCard
                  key={highlight.id}
                  highlight={highlight}
                  isScrolledTo={scrolledToHighlightId === highlight.id}
                  onClick={() => updateHash(highlight)}
                  onEdit={() => onEditHighlight(highlight)}
                  onDelete={() => onDeleteHighlight(highlight)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default HighLightSidebar;
