import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Info,
  Save,
  CheckCircle2,
  CalendarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { ExtractionQuestion } from '@/features/extraction/types/extraction';
import { useBulkSaveAnswers } from '@/features/extraction/hooks/use-extraction-answers';
import { useBulkUpdateExtractionStatus } from '@/features/extraction/hooks/use-extraction-table';
import { useFetchExtractionFormData } from '@/features/extraction/hooks/use-extraction-sections';

interface ExtractionFormSidebarProps {
  referenceId: number;
  reviewId: number;
  isOpen: boolean;
  onExtractionSuccess?: () => void;
}

// Question input component based on type
function QuestionInput({
  question,
  value,
  onChange,
  hasChanged,
}: {
  question: ExtractionQuestion;
  value: string;
  onChange: (value: string) => void;
  hasChanged: boolean;
}) {
  const [date, setDate] = useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Single Select
  if (question.type === 'single-select' && question.options) {
    return (
      <div className="relative">
        <Select
          value={value || '__clear__'}
          onValueChange={(val) => onChange(val === '__clear__' ? '' : val)}
        >
          <SelectTrigger
            className={cn(
              'h-9 text-sm',
              hasChanged && 'border-amber-500 bg-amber-50/50'
            )}
          >
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__clear__">
              <span className="text-muted-foreground italic">Clear</span>
            </SelectItem>
            {question.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasChanged && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
        )}
      </div>
    );
  }

  // Multi Select
  if (question.type === 'multi-select' && question.options) {
    const selectedOptions = value ? value.split(',').map((s) => s.trim()) : [];

    return (
      <div className="space-y-2">
        <div
          className={cn(
            'rounded-md border p-2 min-h-[36px]',
            hasChanged && 'border-amber-500 bg-amber-50/50'
          )}
        >
          {selectedOptions.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              Select options...
            </span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {selectedOptions.map((option, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                >
                  {option}
                </span>
              ))}
            </div>
          )}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs">
              Select Options
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-2">
              {question.options.map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-muted p-1 rounded"
                  onClick={() => {
                    const newOptions = selectedOptions.includes(option)
                      ? selectedOptions.filter((o) => o !== option)
                      : [...selectedOptions, option];
                    onChange(newOptions.join(', '));
                  }}
                >
                  <Checkbox checked={selectedOptions.includes(option)} />
                  <span className="text-sm">{option}</span>
                </div>
              ))}
              {selectedOptions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => onChange('')}
                >
                  Clear All
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Boolean
  if (question.type === 'boolean') {
    return (
      <div className="relative">
        <Select
          value={value || '__clear__'}
          onValueChange={(val) => onChange(val === '__clear__' ? '' : val)}
        >
          <SelectTrigger
            className={cn(
              'h-9 text-sm',
              hasChanged && 'border-amber-500 bg-amber-50/50'
            )}
          >
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__clear__">
              <span className="text-muted-foreground italic">Clear</span>
            </SelectItem>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
        {hasChanged && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
        )}
      </div>
    );
  }

  // Number
  if (question.type === 'number') {
    return (
      <div className="relative">
        <Input
          type="number"
          placeholder="Enter number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'h-9 text-sm',
            hasChanged && 'border-amber-500 bg-amber-50/50'
          )}
        />
        {hasChanged && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
        )}
      </div>
    );
  }

  // Date
  if (question.type === 'date') {
    return (
      <div className="space-y-1">
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-9 text-sm justify-start text-left font-normal w-full',
                !date && 'text-muted-foreground',
                hasChanged && 'border-amber-500 bg-amber-50/50'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, 'PPP') : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(newDate) => {
                setDate(newDate);
                if (newDate) {
                  onChange(format(newDate, 'yyyy-MM-dd'));
                  setIsCalendarOpen(false);
                } else {
                  onChange('');
                }
              }}
              initialFocus
            />
            <div className="p-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setDate(undefined);
                  onChange('');
                  setIsCalendarOpen(false);
                }}
              >
                Clear
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Free Text (default)
  return (
    <div className="relative">
      <Textarea
        placeholder="Enter your answer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'min-h-[72px] text-sm resize-y',
          hasChanged && 'border-amber-500 bg-amber-50/50'
        )}
      />
      {hasChanged && (
        <div className="absolute right-2 top-2 pointer-events-none">
          <div className="h-2 w-2 rounded-full bg-amber-500" />
        </div>
      )}
    </div>
  );
}

export function ExtractionFormSidebar({
  referenceId,
  reviewId,
  isOpen,
  onExtractionSuccess,
}: ExtractionFormSidebarProps) {
  // Fetch form data using the optimized endpoint
  const { data, isLoading } = useFetchExtractionFormData({
    referenceId,
    reviewId,
    isOpen,
  });

  const bulkSaveMutation = useBulkSaveAnswers();
  const bulkUpdateStatusMutation = useBulkUpdateExtractionStatus();

  // State for expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set()
  );

  // Answer state
  const [localAnswers, setLocalAnswers] = useState<Record<number, string>>({});
  const [initialAnswers, setInitialAnswers] = useState<Record<number, string>>(
    {}
  );

  // Initialize local answers when data loads
  useEffect(() => {
    if (data?.sections) {
      const initial: Record<number, string> = {};

      for (const section of data.sections) {
        for (const question of section.questions) {
          initial[question.id] = question.answer?.value || '';
        }
      }

      setLocalAnswers(initial);
      setInitialAnswers(initial);

      // Auto-expand all sections
      setExpandedSections(new Set(data.sections.map((s) => s.id)));
    }
  }, [data]);

  // Reset state when reference changes
  useEffect(() => {
    setLocalAnswers({});
    setInitialAnswers({});
    setExpandedSections(new Set());
  }, [referenceId]);

  // Track which answers have changed
  const changedAnswers = useMemo(() => {
    const changes: Record<number, string> = {};

    for (const [questionId, newValue] of Object.entries(localAnswers)) {
      const qId = Number(questionId);
      const oldValue = initialAnswers[qId] || '';

      if (newValue !== oldValue) {
        changes[qId] = newValue;
      }
    }

    return changes;
  }, [localAnswers, initialAnswers]);

  const hasChanges = Object.keys(changedAnswers).length > 0;

  // Handlers
  const handleToggleSection = useCallback((sectionId: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    if (data?.sections) {
      setExpandedSections(new Set(data.sections.map((s) => s.id)));
    }
  }, [data]);

  const handleCollapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  const handleAnswerChange = useCallback(
    (questionId: number, value: string) => {
      setLocalAnswers((prev) => ({
        ...prev,
        [questionId]: value,
      }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;

    await bulkSaveMutation.mutateAsync({
      referenceId,
      answers: changedAnswers,
    });

    setInitialAnswers(localAnswers);
    onExtractionSuccess?.();
  }, [
    hasChanges,
    referenceId,
    changedAnswers,
    localAnswers,
    bulkSaveMutation,
    onExtractionSuccess,
  ]);

  const handleMarkComplete = useCallback(async () => {
    try {
      // Save first
      await handleSave();

      // Then mark complete
      await bulkUpdateStatusMutation.mutateAsync({
        referenceIds: [referenceId],
        isExtractionCompleted: true,
      });

      onExtractionSuccess?.();
    } catch (error) {
      console.error(error);
    }
  }, [handleSave, referenceId, bulkUpdateStatusMutation, onExtractionSuccess]);

  const isSaving =
    bulkSaveMutation.isPending || bulkUpdateStatusMutation.isPending;

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex h-full flex-col border-l bg-background transition-all duration-300',
          isOpen ? 'w-sm' : 'w-0 overflow-hidden'
        )}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col border-l bg-background transition-all duration-300',
        isOpen ? 'w-sm overflow-auto' : 'w-0 overflow-hidden'
      )}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold">Data Extraction</h2>
            <p className="text-xs text-muted-foreground line-clamp-1">
              Extract data by answering questions
            </p>
          </div>
        </div>
        {hasChanges && (
          <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
            <Info className="h-3 w-3" />
            <span>{Object.keys(changedAnswers).length} unsaved change(s)</span>
          </div>
        )}
      </div>

      {/* Sections */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {data?.sections.map((section) => {
            const isExpanded = expandedSections.has(section.id);

            return (
              <Collapsible
                key={section.id}
                open={isExpanded}
                onOpenChange={() => handleToggleSection(section.id)}
              >
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1 p-1 h-auto"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium text-sm">
                        {section.name}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({section.questions.length})
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent className="mt-2">
                  <div className="space-y-3 pl-4 py-2">
                    {section.questions.map((question) => {
                      const hasChanged =
                        changedAnswers[question.id] !== undefined;

                      return (
                        <div key={question.id} className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <label className="text-sm text-foreground font-medium">
                              {question.columnTitle}
                            </label>
                            {question.required && (
                              <span className="text-destructive text-sm">
                                *
                              </span>
                            )}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent
                                  side="left"
                                  className="max-w-xs"
                                >
                                  <p>{question.question}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>

                          <QuestionInput
                            question={question}
                            value={localAnswers[question.id] || ''}
                            onChange={(value) =>
                              handleAnswerChange(question.id, value)
                            }
                            hasChanged={hasChanged}
                          />

                          {hasChanged && (
                            <span className="text-xs text-amber-600">
                              Modified
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="flex-shrink-0 border-t p-3 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">
            {data?.sections.length || 0} section(s)
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExpandAll}
              className="h-6 text-xs px-2"
            >
              Expand All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCollapseAll}
              className="h-6 text-xs px-2"
            >
              Collapse All
            </Button>
          </div>
        </div>

        <Button
          onClick={handleMarkComplete}
          disabled={isSaving}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Mark as Completed'}
        </Button>

        <Button
          variant="outline"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving
            ? 'Saving...'
            : hasChanges
              ? `Save ${Object.keys(changedAnswers).length} Change(s)`
              : 'No Changes'}
        </Button>
      </div>
    </div>
  );
}
