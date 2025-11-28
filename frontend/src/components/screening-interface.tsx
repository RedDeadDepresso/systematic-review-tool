import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Menu,
  Search,
  ChevronDown,
  Filter,
  MoreHorizontal,
  Plus,
  HelpCircle,
  Settings,
  CircleUser,
  BookOpen,
  FileText,
  Upload,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlignLeft,
  Users,
  Eye,
  Star,
} from 'lucide-react';
import type { Opinion, Reference } from '@/types/reference';
import type { Keyword } from '@/types/keyword';
import { Input } from './ui/input';
import { useCreateKeyword } from '@/hooks/use-keyword';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import * as React from 'react';
import {
  type ColumnDef,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ReviewNavigationMenu } from './review-navigation-menu';
import { Badge } from './ui/badge';
import { useCreateNote } from '@/hooks/use-note';
import { NoteList } from './notes';
import { useUpdateReferenceOpinion } from '@/hooks/use-opinion';
import { useEditReview, useFetchReview } from '@/hooks/use-review';
import { Spinner } from './ui/spinner';

const columns: ColumnDef<Reference>[] = [
  {
    accessorKey: 'title',
  },
  {
    accessorKey: 'authors',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    // Allow this column to be filterable by dropdown
    filterFn: (row, columnId, filterValue) => {
      // If filterValue is empty or "All Articles", show all rows
      if (!filterValue || filterValue === 'All') return true;
      return row.getValue(columnId) === filterValue;
    },
  },
];

function highlightText(
  text: string,
  includeKeywords: string[],
  excludeKeywords: string[]
) {
  if (!text) return text;

  const allKeywords = [
    ...includeKeywords.map((k) => ({ k, type: 'include' })),
    ...excludeKeywords.map((k) => ({ k, type: 'exclude' })),
  ];

  if (allKeywords.length === 0) return text;

  // build regex
  const escaped = allKeywords.map((a) =>
    a.k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  return text.split(regex).map((part, i) => {
    const matched = allKeywords.find(
      (a) => a.k.toLowerCase() === part.toLowerCase()
    );
    if (!matched) return part;

    const bgClass = matched.type === 'include' ? 'bg-green-200' : 'bg-red-200';
    return (
      <span key={i} className={`${bgClass} font-semibold`}>
        {part}
      </span>
    );
  });
}

function normalizeOpinions(opinions: Opinion[] | undefined) {
  if (!opinions) return [];
  return Array.isArray(opinions) ? opinions : [opinions];
}

export default function ScreeningInterface({
  reviewId,
  references,
  inclusiveKeywords,
  exclusiveKeywords,
}: {
  reviewId: string | number;
  references: Reference[];
  inclusiveKeywords: Keyword[];
  exclusiveKeywords: Keyword[];
}) {
  const [statusFilter, setStatusFilter] = useState('Undecided');
  // store the selected row id (string) from react-table; default to "0" (first row) when available
  const [selectedReference, setSelectedReference] = useState(0);
  const [expandedFilters, setExpandedFilters] = useState({
    include: true,
    exclude: true,
  });
  const [hideInputs, sethideInputs] = useState({
    include: true,
    exclude: true,
  });

  // input state for the two keyword forms
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');

  const { mutate, isPending } = useCreateKeyword();
  const updateReferenceOpinion = useUpdateReferenceOpinion();
  const editReview = useEditReview();
  const [content, setContent] = useState('');
  const createNote = useCreateNote();
  const [keywordFilter, setKeywordFilter] = useState(true);

  const handleKeywordSubmit = (
    e: React.FormEvent<HTMLFormElement>,
    isInclusive: boolean
  ) => {
    e.preventDefault();
    const name = (isInclusive ? includeInput : excludeInput).trim();
    if (!name) return;

    // call your mutation with the correct payload
    mutate({
      review_id: reviewId,
      name,
      is_inclusive: isInclusive,
    });

    // clear the corresponding input (you can also close the input panel if desired)
    if (isInclusive) setIncludeInput('');
    else setExcludeInput('');
  };

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) return;

    createNote.mutate(
      {
        reviewId,
        referenceId: references[selectedReference].id,
        data: { content },
      },
      {
        onSuccess: () => {
          setContent('');
        },
        onError: (error) => {
          console.error(error);
        },
      }
    );
  };

  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<any[]>([]);
  const [selectedIncludeKeywords, setSelectedIncludeKeywords] = useState<
    string[]
  >([]);
  const [selectedExcludeKeywords, setSelectedExcludeKeywords] = useState<
    string[]
  >([]);

  const table = useReactTable<Reference>({
    data: references,
    columns,
    state: {
      sorting,
      rowSelection,
      columnFilters,
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const statuses = ['All', 'Undecided', 'Excluded', 'Maybe', 'Included'];

  React.useEffect(() => {
    document.body.style.overflow = 'hidden';

    // Cleanup in case component unmounts
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);
  const fetchReview = useFetchReview(Number(reviewId));

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <ReviewNavigationMenu reviewId={reviewId} />
      <div className="flex items-center justify-between w-full mt-6">
        <h3 className="text-sm font-semibold ">
          Showing {statusFilter} references
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-1"
            size="sm"
            onClick={() =>
              editReview.mutate({
                id: Number(reviewId),
                data: {
                  is_blinded: fetchReview.data?.is_blinded ? false : true,
                },
              })
            }
            disabled={editReview.isPending || fetchReview.isLoading}
          >
            <Eye className="h-3 w-3" />
            {fetchReview.isLoading ? (
              <Spinner />
            ) : fetchReview.data?.is_blinded ? (
              'Blind On'
            ) : (
              'Blind Off'
            )}
          </Button>
          <Button variant="outline" className="gap-1" size="sm">
            <Upload className="h-3 w-3" />
            Upload PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 bg-transparent"
            onClick={() => setKeywordFilter(!keywordFilter)}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - references List */}
        <div className="w-80 border-r border-gray-200 flex flex-col ">
          {/* Header */}
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <Checkbox id="select-all" />

              {/* Dropdown for filter options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="text-xs text-muted-foreground font-medium flex items-center gap-1"
                  >
                    {statusFilter}
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {statuses.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => {
                        setStatusFilter(status);

                        setColumnFilters(
                          status === 'All'
                            ? []
                            : [{ id: 'status', value: status }]
                        );
                      }}
                    >
                      {status}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* --- Sort Dropdown --- */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="text-xs text-muted-foreground font-medium flex items-center gap-1 ml-auto"
                  >
                    Sort by
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => {
                      setSorting([{ id: 'authors', desc: false }]);
                    }}
                  >
                    Author (A-Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSorting([{ id: 'authors', desc: true }]);
                    }}
                  >
                    Author (Z-A)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSorting([{ id: 'title', desc: false }]);
                    }}
                  >
                    Title (A-Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSorting([{ id: 'title', desc: true }]);
                    }}
                  >
                    Title (Z-A)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* references List */}
          <div className="flex-1 overflow-y-auto">
            {table.getRowModel().rows.map((row) => {
              const opinions = normalizeOpinions(row.original.opinions);

              return (
                <div
                  key={row.index}
                  onClick={() => setSelectedReference(row.index)}
                  className={`
        cursor-pointer 
        border-b border-border 
        p-4 
        transition-colors 
        ${selectedReference === row.index ? 'bg-muted' : 'hover:bg-accent'}
      `}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-400 w-5">
                          {row.index}
                        </span>
                        <div className="flex-1">
                          {/* Title */}
                          <p className="text-sm font-medium leading-snug">
                            {highlightText(
                              row.original.title,
                              selectedIncludeKeywords,
                              selectedExcludeKeywords
                            )}
                          </p>

                          {/* Authors */}
                          <p className="text-xs text-muted-foreground">
                            {row.original.authors}
                          </p>

                          {/* ALL opinion badges */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {opinions.map((op, idx) => (
                              <Badge
                                key={idx}
                                className={`flex items-center gap-1 ${
                                  op.status === 'Included'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : op.status === 'Maybe'
                                      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                      : op.status === 'Excluded'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-gray-50 text-gray-600 border-gray-200'
                                }`}
                              >
                                {op.status === 'Included' && '✓'}
                                {op.status === 'Maybe' && '?'}
                                {op.status === 'Excluded' && '✕'}
                                <span>{op.reviewer}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center - Article Details */}
        <div className="flex-1 border-r border-gray-200 flex flex-col ">
          {/* Details Header */}
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold ">
                {highlightText(
                  references[selectedReference].title,
                  selectedIncludeKeywords,
                  selectedExcludeKeywords
                )}
              </h2>
              {/* <Button variant="ghost" size="sm" className="px-2">
                <MoreHorizontal className="h-5 w-5" />
              </Button> */}
            </div>
          </div>

          {/* Article Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Publication Types:
              </h3>
              <p className="text-sm">
                {references[selectedReference].publication_types}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Authors:
              </h3>
              <p className="text-sm">{references[selectedReference].authors}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Journal:
              </h3>
              <p className="text-sm">{references[selectedReference].journal}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Search Methods:
              </h3>
              <p className="text-sm">
                {references[selectedReference].search_methods}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlignLeft className="w-5 h-5" />
                Abstract:
              </h3>
              <p className="text-sm">
                {highlightText(
                  references[selectedReference].abstract || '',
                  selectedIncludeKeywords,
                  selectedExcludeKeywords
                )}
              </p>
            </div>

            <NoteList
              reviewId={Number(reviewId)}
              referenceId={references[selectedReference].id}
            />

            {/* <div>
              <h3 className="text-sm font-semibold  mb-2 flex items-center gap-2">
                <span className="text-lg">⚙️</span>
                Article Customizations:
              </h3>
              <p className="text-sm ">Accessed: 31/03/2025</p>
            </div> */}
          </div>

          {/* Decision Buttons */}
          <div className="border-t border-gray-200 p-6">
            <div className="flex gap-2 mb-4">
              <Button
                className="flex-1 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                onClick={() =>
                  updateReferenceOpinion.mutate({
                    reviewId: Number(reviewId),
                    referenceId: references[selectedReference].id,
                    data: { status: 'Included' },
                  })
                }
                disabled={updateReferenceOpinion.isPending}
              >
                ✓ Include
              </Button>

              <Button
                className="flex-1 bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100"
                onClick={() =>
                  updateReferenceOpinion.mutate({
                    reviewId: Number(reviewId),
                    referenceId: references[selectedReference].id,
                    data: { status: 'Maybe' },
                  })
                }
                disabled={updateReferenceOpinion.isPending}
              >
                ? Maybe
              </Button>

              <Button
                className="flex-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                onClick={() =>
                  updateReferenceOpinion.mutate({
                    reviewId: Number(reviewId),
                    referenceId: references[selectedReference].id,
                    data: { status: 'Excluded' },
                  })
                }
                disabled={updateReferenceOpinion.isPending}
              >
                ✕ Exclude
              </Button>

              {/* <Button className="flex-1 bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100">
                ⚠ Reason
              </Button>

              <Button className="flex-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
                🏷 Label
              </Button> */}
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg w-full">
              <CircleUser className="h-8 w-8 " />
              <form
                onSubmit={handleNoteSubmit}
                className="flex items-center space-x-2 w-full"
              >
                <Input
                  type="text"
                  placeholder="Add note"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="flex-1 bg-transparent text-sm placeholder-gray-400 outline-none w-full"
                />
                <Button type="submit" disabled={createNote.isPending}>
                  {createNote.isPending ? 'Saving...' : 'Add'}
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Filters */}
        {keywordFilter && (
          <div className="w-72 border-l border-gray-200 flex flex-col overflow-y-auto">
            {/* Filter Header */}
            <div className="border-b border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search"
                  className="flex-1 bg-transparent text-sm placeholder-gray-400 outline-none"
                />
              </div>
            </div>

            {/* Filters Content */}
            <div className="flex-1">
              {/* Include Keywords Section */}
              <div className="border-b border-gray-100 p-4">
                {/* <button
                onClick={() =>
                  setExpandedFilters({
                    ...expandedFilters,
                    include: !expandedFilters.include,
                  })
                }
                className="flex w-full items-center justify-between"
              > */}
                <button
                  onClick={() =>
                    sethideInputs({
                      ...hideInputs,
                      include: !hideInputs.include,
                    })
                  }
                  className="flex w-full items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium ">
                      Keywords for include
                    </span>
                  </div>
                  <Plus className="h-4 w-4 text-green-600" />
                </button>
                {!hideInputs.include && (
                  <form onSubmit={(e) => handleKeywordSubmit(e, true)}>
                    <Input
                      value={includeInput}
                      onChange={(e) =>
                        setIncludeInput((e.target as HTMLInputElement).value)
                      }
                      placeholder="Add include keyword and press Enter"
                      disabled={isPending}
                    />
                  </form>
                )}

                {expandedFilters.include && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all-include"
                        checked={
                          selectedIncludeKeywords.length ===
                          inclusiveKeywords.length
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIncludeKeywords(
                              inclusiveKeywords.map((k) => k.name)
                            );
                          } else {
                            setSelectedIncludeKeywords([]);
                          }
                        }}
                      />
                      <label
                        htmlFor="select-all-include"
                        className="text-sm  flex-1 cursor-pointer"
                      >
                        Select All
                      </label>
                    </div>

                    <Separator />

                    {inclusiveKeywords.map((keyword) => (
                      <div
                        key={keyword.name}
                        className="flex items-center gap-2 pl-6"
                      >
                        <Checkbox
                          id={`include-${keyword.name}`}
                          checked={selectedIncludeKeywords.includes(
                            keyword.name
                          )}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedIncludeKeywords((prev) => [
                                ...prev,
                                keyword.name,
                              ]);
                            } else {
                              setSelectedIncludeKeywords((prev) =>
                                prev.filter((k) => k !== keyword.name)
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={`include-${keyword.name}`}
                          className="text-sm flex-1 cursor-pointer"
                        >
                          {keyword.name}
                        </label>
                        {/* <span className="text-xs text-gray-400">0</span> */}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Exclude Keywords Section */}
              <div className="border-b border-gray-100 p-4">
                {/* <button
                onClick={() =>
                  setExpandedFilters({
                    ...expandedFilters,
                    exclude: !expandedFilters.exclude,
                  })
                }
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium ">Keywords for exclude</span>
                </div>
                <Plus className="h-4 w-4 text-red-600" />
              </button> */}
                <button
                  onClick={() =>
                    sethideInputs({
                      ...hideInputs,
                      exclude: !hideInputs.exclude,
                    })
                  }
                  className="flex w-full items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium ">
                      Keywords for exclude
                    </span>
                  </div>
                  <Plus className="h-4 w-4 text-red-600" />
                </button>

                {!hideInputs.exclude && (
                  <form onSubmit={(e) => handleKeywordSubmit(e, false)}>
                    <Input
                      value={excludeInput}
                      onChange={(e) =>
                        setExcludeInput((e.target as HTMLInputElement).value)
                      }
                      placeholder="Add exclude keyword and press Enter"
                      disabled={isPending}
                    />
                  </form>
                )}

                {expandedFilters.exclude && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all-exclude"
                        checked={
                          selectedExcludeKeywords.length ===
                          exclusiveKeywords.length
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedExcludeKeywords(
                              exclusiveKeywords.map((k) => k.name)
                            );
                          } else {
                            setSelectedExcludeKeywords([]);
                          }
                        }}
                      />

                      <label
                        htmlFor="select-all-exclude"
                        className="text-sm  flex-1 cursor-pointer"
                      >
                        Select All
                      </label>
                    </div>

                    <Separator />

                    {exclusiveKeywords.map((keyword) => (
                      <div
                        key={keyword.name}
                        className="flex items-center gap-2 pl-6"
                      >
                        <Checkbox
                          id={`exclude-${keyword.name}`}
                          checked={selectedExcludeKeywords.includes(
                            keyword.name
                          )}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedExcludeKeywords((prev) => [
                                ...prev,
                                keyword.name,
                              ]);
                            } else {
                              setSelectedExcludeKeywords((prev) =>
                                prev.filter((k) => k !== keyword.name)
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={`exclude-${keyword.name}`}
                          className="text-sm  flex-1 cursor-pointer"
                        >
                          {keyword.name}
                        </label>
                        {/* <span className="text-xs text-gray-400">15</span> */}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
