import { CheckCircle2, Plus, Search, XCircle } from 'lucide-react';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { useState } from 'react';
import { useCreateKeyword } from '@/hooks/use-keyword';
import { Checkbox } from '../ui/checkbox';
import type { Keyword } from '@/types/keyword';

export function KeywordFilters({
  reviewId,
  inclusiveKeywords,
  exclusiveKeywords,
  selectedIncludeKeywords,
  setSelectedIncludeKeywords,
  selectedExcludeKeywords,
  setSelectedExcludeKeywords,
}: {
  reviewId: number;
  inclusiveKeywords: Keyword[];
  exclusiveKeywords: Keyword[];
  selectedIncludeKeywords: string[];
  setSelectedIncludeKeywords: (keywords: string[]) => void;
  selectedExcludeKeywords: string[];
  setSelectedExcludeKeywords: (keywords: string[]) => void;
}) {
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
  return (
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
              <span className="text-sm font-medium ">Keywords for include</span>
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
                    selectedIncludeKeywords.length === inclusiveKeywords.length
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
                    checked={selectedIncludeKeywords.includes(keyword.name)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIncludeKeywords([
                          ...selectedIncludeKeywords,
                          keyword.name,
                        ]);
                      } else {
                        setSelectedIncludeKeywords(
                          selectedIncludeKeywords.filter(
                            (k) => k !== keyword.name
                          )
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
              <span className="text-sm font-medium ">Keywords for exclude</span>
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
                    selectedExcludeKeywords.length === exclusiveKeywords.length
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
                    checked={selectedExcludeKeywords.includes(keyword.name)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedExcludeKeywords([
                          ...selectedExcludeKeywords,
                          keyword.name,
                        ]);
                      } else {
                        setSelectedExcludeKeywords(
                          selectedExcludeKeywords.filter(
                            (k) => k !== keyword.name
                          )
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
  );
}
