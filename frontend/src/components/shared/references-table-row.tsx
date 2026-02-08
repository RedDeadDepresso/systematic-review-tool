import React from 'react';
import { CircleUser, ExternalLink, Link2, Paperclip } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Reference, Label } from '@/types/reference';
import { highlightText } from '@/lib/reference';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Button } from '../ui/button';
import type { ReviewMember } from '@/types/review';

interface OpinionBadgeProps {
  opinion: { member: ReviewMember; status: string; reason: string | null };
}

function OpinionBadge({ opinion }: OpinionBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          className={cn(
            'flex items-center gap-1 text-xs',
            opinion.status === 'Included' &&
              'bg-green-50 text-green-700 border-green-200',
            opinion.status === 'Maybe' &&
              'bg-yellow-50 text-yellow-700 border-yellow-200',
            opinion.status === 'Excluded' &&
              'bg-red-50 text-red-700 border-red-200',
            opinion.status === 'Undecided' &&
              'bg-gray-50 text-gray-600 border-gray-200'
          )}
        >
          {opinion.status === 'Included' && '✓'}
          {opinion.status === 'Maybe' && '?'}
          {opinion.status === 'Excluded' && '✕'}
          <span>{opinion.member.user.firstName}</span>
          {opinion.reason && <span>- {opinion.reason}</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {opinion.status} by {opinion.member.user.email}
      </TooltipContent>
    </Tooltip>
  );
}

export function AssigneeBadge({ assignee }: { assignee: ReviewMember }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="text-xs gap-1">
          <CircleUser className="h-3 w-3" />
          {assignee.user.firstName}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Assigned to {assignee.user.email}</TooltipContent>
    </Tooltip>
  );
}

export function LabelBadge({ label }: { label: Label }) {
  return (
    <Badge
      key={label.id}
      variant="outline"
      className="text-xs"
      style={{
        borderColor: label.color,
        color: label.color,
        backgroundColor: `${label.color}10`,
      }}
    >
      {label.name}
    </Badge>
  );
}

interface ReferenceRowProps {
  reference: Reference;
  index: number;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: () => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  highlightIncludeKeywords: string[];
  highlightExcludeKeywords: string[];
  onOpenPDF: (referenceId: number) => void;
}

export function ReferenceRowTitleOnly({
  reference: ref,
  index,
  isSelected,
  isHighlighted,
  onSelect,
  onClick,
  onDoubleClick,
  highlightIncludeKeywords,
  highlightExcludeKeywords,
  onOpenPDF,
}: ReferenceRowProps) {
  return (
    <div
      data-reference-id={ref.id}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        'flex items-start px-3 sm:px-6 py-3 sm:py-4 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer',
        isSelected && 'bg-primary/5',
        isHighlighted && 'bg-primary/10 ring-1 ring-primary/30'
      )}
    >
      {/* Checkbox */}
      <div className="flex items-center gap-3 w-10 pt-1" data-checkbox-area>
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      </div>

      {/* Index */}
      <div className="flex items-start gap-3 w-6 sm:w-10 pt-1">
        <span className="text-xs sm:text-sm text-muted-foreground">
          {index + 1}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p className="text-xs sm:text-sm leading-relaxed">
          {highlightText(
            ref.title,
            highlightIncludeKeywords,
            highlightExcludeKeywords
          )}
        </p>

        {/* Opinions */}
        {ref.opinions?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {ref.opinions.map((opinion, idx) => (
              <OpinionBadge key={idx} opinion={opinion} />
            ))}
          </div>
        )}

        {/* Labels + PDF + Assignee */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {ref.file && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onOpenPDF(ref.id)}
                >
                  PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open PDF</TooltipContent>
            </Tooltip>
          )}

          {ref.assignee && <AssigneeBadge assignee={ref.assignee} />}

          {ref.labels.map((label: Label) => (
            <LabelBadge key={label.id} label={label} />
          ))}
        </div>
      </div>

      {/* Date (hidden on mobile) */}
      <div className="hidden sm:block w-28 text-sm text-muted-foreground whitespace-nowrap pt-1">
        {ref.publicationDate || 'N/A'}
      </div>

      {/* Author (hidden on tablet) */}
      <div className="hidden md:block w-32 text-sm text-muted-foreground truncate pt-1">
        {ref.authors}
      </div>
    </div>
  );
}

export function ReferenceRowTitleAbstract({
  reference: ref,
  index,
  isSelected,
  isHighlighted,
  onSelect,
  onClick,
  onDoubleClick,
  highlightIncludeKeywords,
  highlightExcludeKeywords,
  onOpenPDF,
}: ReferenceRowProps) {
  return (
    <div
      data-reference-id={ref.id}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        'cursor-pointer border-b border-border p-4 transition-colors',
        isSelected && 'bg-muted',
        isHighlighted && 'bg-primary/10 ring-1 ring-primary/30',
        !isSelected && !isHighlighted && 'hover:bg-accent'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div data-checkbox-area>
          <Checkbox
            className="mt-1"
            checked={isSelected}
            onCheckedChange={onSelect}
          />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-start gap-2">
            {/* Index */}
            <span className="text-xs font-semibold text-muted-foreground w-5 mt-0.5">
              {index + 1}
            </span>

            <div className="flex-1 min-w-0">
              {/* Title */}
              <p className="text-sm font-medium leading-snug">
                {highlightText(
                  ref.title,
                  highlightIncludeKeywords,
                  highlightExcludeKeywords
                )}
              </p>

              {/* Date */}
              <p className="text-xs text-muted-foreground mt-1">
                {ref.publicationDate || 'N/A'}
              </p>

              {/* Authors */}
              <p className="text-xs text-muted-foreground mt-1">
                {ref.authors}
              </p>

              {/* Opinions */}
              {ref.opinions?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {ref.opinions.map((opinion, idx) => (
                    <OpinionBadge key={idx} opinion={opinion} />
                  ))}
                </div>
              )}

              {/* Labels + PDF + Assignee */}
              <div className="flex flex-wrap gap-2 mt-2">
                {ref.file && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenPDF(ref.id)}
                      >
                        PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open PDF</TooltipContent>
                  </Tooltip>
                )}

                {ref.assignee && <AssigneeBadge assignee={ref.assignee} />}

                {ref.labels.map((label: Label) => (
                  <LabelBadge key={label.id} label={label} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const handleOpenDOI = (e: React.MouseEvent, ref: Reference) => {
  e.stopPropagation(); // Don't trigger row click

  if (!ref.doi) return;

  // Handle both "10.1234/example" and full URLs
  const doiUrl = ref.doi.startsWith('http')
    ? ref.doi
    : `https://doi.org/${ref.doi}`;

  window.open(doiUrl, '_blank', 'noopener,noreferrer');
};

const handleOpenURL = (e: React.MouseEvent, ref: Reference) => {
  e.stopPropagation(); // Don't trigger row click

  if (!ref.url) return;

  window.open(ref.url, '_blank', 'noopener,noreferrer');
};

export function ReferenceRowTitleFile({
  reference: ref,
  index,
  isSelected,
  isHighlighted,
  onSelect,
  onClick,
  onDoubleClick,
  highlightIncludeKeywords,
  highlightExcludeKeywords,
  onOpenPDF,
}: ReferenceRowProps) {
  return (
    <div
      data-reference-id={ref.id}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        'flex items-start px-3 sm:px-6 py-3 sm:py-4 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer',
        isSelected && 'bg-primary/5',
        isHighlighted && 'bg-primary/10 ring-1 ring-primary/30'
      )}
    >
      {/* Checkbox */}
      <div className="flex items-center gap-3 w-10 pt-1" data-checkbox-area>
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      </div>

      {/* Index */}
      <div className="flex items-start gap-3 w-6 sm:w-10 pt-1">
        <span className="text-xs sm:text-sm text-muted-foreground">
          {index + 1}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p className="text-xs sm:text-sm leading-relaxed">
          {highlightText(
            ref.title,
            highlightIncludeKeywords,
            highlightExcludeKeywords
          )}
        </p>

        {/* Opinions */}
        {ref.opinions?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {ref.opinions.map((opinion, idx) => (
              <OpinionBadge key={idx} opinion={opinion} />
            ))}
          </div>
        )}

        {/* Labels + PDF + Assignee */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {ref.assignee && <AssigneeBadge assignee={ref.assignee} />}

          {ref.labels.map((label: Label) => (
            <LabelBadge key={label.id} label={label} />
          ))}
        </div>
      </div>

      {/* Date (hidden on mobile) */}
      <div className="hidden sm:block w-28 text-sm text-muted-foreground whitespace-nowrap pt-1">
        {ref.publicationDate || 'N/A'}
      </div>

      {/* Author (hidden on tablet) */}
      <div className="hidden md:block w-32 text-sm text-muted-foreground truncate pt-1">
        {ref.authors}
      </div>

      {/* PDF Button Column */}
      <div className="w-28 flex items-start pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPDF(ref.id);
          }}
          disabled={!ref.file}
          className={cn(
            'gap-2 w-full',
            !ref.file && 'opacity-50 cursor-not-allowed'
          )}
        >
          {ref.file && <ExternalLink className="h-4 w-4" />}
          <span className="hidden lg:inline">
            {ref.file ? 'Attached' : 'None'}
          </span>
        </Button>
      </div>

      {/* Button Group Column */}
      <div className="w-48 flex items-start gap-1 pt-1 justify-end">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => handleOpenDOI(e, ref)}
              disabled={!ref.doi}
            >
              DOI
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {ref.doi ? `Open DOI: ${ref.doi}` : 'No DOI available'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => handleOpenURL(e, ref)}
              disabled={!ref.url}
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{ref.url || 'No URL available'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenPDF(ref.id)}
            >
              <Paperclip />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Attach PDF</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
