import { highlightText } from '@/lib/reference';
import { cn } from '@/lib/utils';
import type { Reference } from '@/types/reference';
import {
  BookOpen,
  Building,
  FileText,
  FolderOpen,
  Hash,
  LinkIcon,
  MessageSquare,
  Users,
} from 'lucide-react';
import { NotesList } from './note';

function DetailSection({
  icon: Icon,
  label,
  children,
  diffClassName,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  diffClassName?: string;
}) {
  return (
    <div
      className={cn(
        'py-4 border-b border-border last:border-b-0 transition-colors',
        diffClassName
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground mb-1">{label}:</p>
          <div className="text-sm text-muted-foreground leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface ReferenceContentProps {
  reference: Reference;
  highlightIncludeKeywords?: string[];
  highlightExcludeKeywords?: string[];
  compareWith?: Reference;
  side?: 'left' | 'right';
  highlightDifference?: boolean;
  showNotes?: boolean;
}

function diffClass(
  value: string | null | undefined,
  other: string | null | undefined,
  side: 'left' | 'right'
) {
  if (!value || value === other) return '';

  return side === 'left'
    ? 'bg-destructive/10 border-l-4 border-destructive hover:bg-destructive/15'
    : 'bg-primary/10 border-l-4 border-primary hover:bg-primary/15';
}

function sectionDiff(
  value: string | null | undefined,
  other: string | null | undefined,
  side?: 'left' | 'right',
  enabled?: boolean
) {
  if (!enabled || !side) return undefined;
  return diffClass(value, other, side);
}

export function ReferenceContent({
  reference,
  compareWith,
  side,
  highlightDifference,
  highlightIncludeKeywords = [],
  highlightExcludeKeywords = [],
  showNotes = false,
}: ReferenceContentProps) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="space-y-0">
        <DetailSection
          icon={FileText}
          label="Abstract"
          diffClassName={sectionDiff(
            reference.abstract,
            compareWith?.abstract,
            side,
            highlightDifference
          )}
        >
          {highlightText(
            reference.abstract,
            highlightIncludeKeywords,
            highlightExcludeKeywords
          )}
        </DetailSection>

        <DetailSection
          icon={BookOpen}
          label="Publication Types"
          diffClassName={sectionDiff(
            reference.publicationType,
            compareWith?.publicationType,
            side,
            highlightDifference
          )}
        >
          {highlightText(
            reference.publicationType,
            highlightIncludeKeywords,
            highlightExcludeKeywords
          )}
        </DetailSection>

        <DetailSection
          icon={Users}
          label="Authors"
          diffClassName={sectionDiff(
            reference.authors,
            compareWith?.authors,
            side,
            highlightDifference
          )}
        >
          {highlightText(
            reference.authors,
            highlightIncludeKeywords,
            highlightExcludeKeywords
          )}
        </DetailSection>

        <DetailSection
          icon={Building}
          label="Journal"
          diffClassName={sectionDiff(
            reference.journal,
            compareWith?.journal,
            side,
            highlightDifference
          )}
        >
          {highlightText(
            reference.journal,
            highlightIncludeKeywords,
            highlightExcludeKeywords
          )}
          {reference.publicationDate &&
            ` - published ${reference.publicationDate}`}
        </DetailSection>

        <DetailSection icon={Hash} label="Reference ID">
          {reference.id}
        </DetailSection>

        {reference.url && (
          <DetailSection
            icon={LinkIcon}
            label="URL"
            diffClassName={sectionDiff(
              reference.url,
              compareWith?.url,
              side,
              highlightDifference
            )}
          >
            <a
              href={reference.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all"
            >
              {reference.url}
            </a>
          </DetailSection>
        )}

        {reference.doi && (
          <DetailSection
            icon={Hash}
            label="DOI"
            diffClassName={sectionDiff(
              reference.doi,
              compareWith?.doi,
              side,
              highlightDifference
            )}
          >
            <a
              href={`https://doi.org/${reference.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all"
            >
              {reference.doi}
            </a>
          </DetailSection>
        )}

        <DetailSection
          icon={FolderOpen}
          label="Search Methods"
          diffClassName={sectionDiff(
            reference.searchMethod,
            compareWith?.searchMethod,
            side,
            highlightDifference
          )}
        >
          Uploaded References [{reference.searchMethod}]
        </DetailSection>
        {showNotes && (
          <DetailSection icon={MessageSquare} label="Notes">
            <NotesList referenceId={reference.id} compact={true} />
          </DetailSection>
        )}
      </div>
    </div>
  );
}
