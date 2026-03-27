// Dropdown to assign a question to a data-extraction section.
import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useFetchExtractionSections } from '@/features/extraction/hooks/use-extraction-sections';
import { useCreateExtractionSection } from '@/features/extraction/hooks/use-extraction-sections';

interface SectionSelectProps {
  value: number | null;
  onChange: (sectionId: number) => void;
  reviewId: number;
  placeholder?: string;
}

export function SectionSelect({
  value,
  onChange,
  reviewId,
  placeholder = 'Select section...',
}: SectionSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: sections = [] } = useFetchExtractionSections({ reviewId });
  const createSectionMutation = useCreateExtractionSection();

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    return sections.filter((section) =>
      section.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sections, searchQuery]);

  const showCreateOption = useMemo(() => {
    if (!searchQuery.trim()) return false;
    const exactMatch = sections.some(
      (s) => s.name.toLowerCase() === searchQuery.trim().toLowerCase()
    );
    return !exactMatch;
  }, [sections, searchQuery]);

  const selectedSection = sections.find((s) => s.id === value);

  const handleSelect = (sectionId: number) => {
    onChange(sectionId);
    setOpen(false);
    setSearchQuery('');
  };

  const handleCreateSection = async () => {
    if (!searchQuery.trim() || createSectionMutation.isPending) return;

    createSectionMutation.mutate(
      {
        review: reviewId,
        name: searchQuery.trim(),
      },
      {
        onSuccess: (data) => {
          onChange(data.id);
          setOpen(false);
          setSearchQuery('');
        },
      }
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal bg-transparent"
        >
          {selectedSection ? (
            <span className="text-foreground">{selectedSection.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <div className="flex flex-col">
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or create section..."
              className="h-8"
            />
          </div>

          {/* Sections list */}
          <div className="max-h-48 overflow-y-auto">
            {filteredSections.map((section) => (
              <button
                key={section.id}
                onClick={() => handleSelect(section.id)}
                className={cn(
                  'flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors',
                  value === section.id && 'bg-accent'
                )}
              >
                <span>{section.name}</span>
                {value === section.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}

            {/* Create new section option */}
            {showCreateOption && (
              <button
                onClick={handleCreateSection}
                disabled={createSectionMutation.isPending}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-primary hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>
                  {createSectionMutation.isPending
                    ? 'Creating...'
                    : `Create "${searchQuery.trim()}"`}
                </span>
              </button>
            )}

            {filteredSections.length === 0 && !showCreateOption && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No sections found
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
