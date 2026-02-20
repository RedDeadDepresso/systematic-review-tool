import { Search, FileText, Square } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { type HighlightType } from 'react-pdf-highlighter-plus';

export type SortOption = 'page' | 'newest' | 'type';

interface HighlightFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilters: HighlightType[];
  onFilterChange: (filters: HighlightType[]) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const filterOptions: {
  type: HighlightType;
  icon: typeof FileText;
  label: string;
}[] = [
  { type: 'text', icon: FileText, label: 'Text' },
  { type: 'area', icon: Square, label: 'Area' },
];

export function HighlightFilters({
  searchQuery,
  onSearchChange,
  activeFilters,
  onFilterChange,
  sortBy,
  onSortChange,
}: HighlightFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search highlights..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter buttons */}
      <TooltipProvider>
        <ToggleGroup
          type="multiple"
          value={activeFilters}
          onValueChange={(value) => onFilterChange(value as HighlightType[])}
          className="flex-wrap justify-start gap-1"
        >
          {filterOptions.map(({ type, icon: Icon, label }) => (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value={type}
                  aria-label={`Filter ${label}`}
                  className="h-8 w-8 p-0"
                >
                  <Icon className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
      </TooltipProvider>

      {/* Sort dropdown */}
      <Select
        value={sortBy}
        onValueChange={(value) => onSortChange(value as SortOption)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="page">Sort by Page</SelectItem>
          <SelectItem value="newest">Sort by Newest</SelectItem>
          <SelectItem value="type">Sort by Type</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
