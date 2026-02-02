import type { ArticleViewLayout, Reference } from '@/types/reference';
import {
  ReferenceRowTitleAbstract,
  ReferenceRowTitleFile,
  ReferenceRowTitleOnly,
} from './references-table-row';

interface ReferenceTableBody {
  references: Reference[];
  selectedReferenceIds: number[];
  highlightedReferenceId: number | null;
  onSelectReference: (id: number) => void;
  onHighlightReference: (id: number | null) => void;
  highlightIncludeKeywords?: string[];
  highlightExcludeKeywords?: string[];
  onOpenDetail: (id: number) => void;
  viewLayout?: ArticleViewLayout;
  onOpenPDF: (referenceId: number) => void;
}

export function ReferencesTableBody({
  references,
  selectedReferenceIds,
  highlightedReferenceId,
  onSelectReference,
  highlightIncludeKeywords = [],
  highlightExcludeKeywords = [],
  onHighlightReference,
  onOpenDetail,
  viewLayout,
  onOpenPDF,
}: ReferenceTableBody) {
  const handleRowClick = (id: number, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-checkbox-area]')) return;
    onHighlightReference(highlightedReferenceId === id ? null : id);
  };

  const handleRowDoubleClick = (id: number, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-checkbox-area]')) return;
    onHighlightReference(id);
    onOpenDetail(id);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {references.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          No references found matching your filters.
        </div>
      ) : viewLayout === 'title-abstract' ? (
        references.map((ref, index) => (
          <ReferenceRowTitleAbstract
            key={ref.id}
            reference={ref}
            index={index}
            isSelected={selectedReferenceIds.includes(ref.id)}
            isHighlighted={highlightedReferenceId === ref.id}
            onSelect={() => onSelectReference(ref.id)}
            onClick={(e) => handleRowClick(ref.id, e)}
            onDoubleClick={(e) => handleRowDoubleClick(ref.id, e)}
            highlightIncludeKeywords={highlightIncludeKeywords}
            highlightExcludeKeywords={highlightExcludeKeywords}
            onOpenPDF={onOpenPDF}
          />
        ))
      ) : viewLayout === 'title-file' ? (
        references.map((ref, index) => (
          <ReferenceRowTitleFile
            key={ref.id}
            reference={ref}
            index={index}
            isSelected={selectedReferenceIds.includes(ref.id)}
            isHighlighted={highlightedReferenceId === ref.id}
            onSelect={() => onSelectReference(ref.id)}
            onClick={(e) => handleRowClick(ref.id, e)}
            onDoubleClick={(e) => handleRowDoubleClick(ref.id, e)}
            highlightIncludeKeywords={highlightIncludeKeywords}
            highlightExcludeKeywords={highlightExcludeKeywords}
            onOpenPDF={onOpenPDF}
          />
        ))
      ) : (
        references.map((ref, index) => (
          <ReferenceRowTitleOnly
            key={ref.id}
            reference={ref}
            index={index}
            isSelected={selectedReferenceIds.includes(ref.id)}
            isHighlighted={highlightedReferenceId === ref.id}
            onSelect={() => onSelectReference(ref.id)}
            onClick={(e) => handleRowClick(ref.id, e)}
            onDoubleClick={(e) => handleRowDoubleClick(ref.id, e)}
            highlightIncludeKeywords={highlightIncludeKeywords}
            highlightExcludeKeywords={highlightExcludeKeywords}
            onOpenPDF={onOpenPDF}
          />
        ))
      )}
    </div>
  );
}
