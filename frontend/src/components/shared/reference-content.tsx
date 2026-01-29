import { highlightText } from '@/lib/reference';
import type { Reference } from '@/types/reference';
import {
  BookOpen,
  Building,
  FileText,
  FolderOpen,
  Hash,
  LinkIcon,
  Users,
} from 'lucide-react';

function DetailSection({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4 border-b border-border last:border-b-0">
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
}

export function ReferenceContent({
  reference,
  highlightIncludeKeywords = [],
  highlightExcludeKeywords = [],
}: ReferenceContentProps) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="space-y-0">
        <DetailSection icon={FileText} label="Abstract">
          {highlightText(
            reference.abstract,
            highlightIncludeKeywords,
            highlightExcludeKeywords
          )}
        </DetailSection>

        <DetailSection icon={BookOpen} label="Publication Types">
          {highlightText(
            reference.publicationType,
            highlightIncludeKeywords,
            highlightExcludeKeywords
          )}
        </DetailSection>

        <DetailSection icon={Users} label="Authors">
          {highlightText(
            reference.authors,
            highlightIncludeKeywords,
            highlightExcludeKeywords
          )}
        </DetailSection>

        <DetailSection icon={Building} label="Journal">
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
          <DetailSection icon={LinkIcon} label="URL">
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
          <DetailSection icon={Hash} label="DOI">
            <a
              href={`https://doi.org/${reference.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {reference.doi}
            </a>
          </DetailSection>
        )}

        <DetailSection icon={FolderOpen} label="Search Methods">
          Uploaded References [{reference.searchMethod}]
        </DetailSection>
      </div>
    </div>
  );
}
