'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  ChevronDown,
  ChevronRight,
  FileText,
  Info,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExtractionQuestion } from '@/types/extraction';
import { useFetchExtractionQuestions } from '@/hooks/use-extraction-question';
import { useFetchExtractionSections } from '@/hooks/use-extraction-section';
import {
  useFetchExtractionAnswers,
  useBulkSaveAnswers,
} from '@/hooks/use-extraction-answer';
import { useBulkUpdateExtractionStatus } from '@/hooks/use-extraction-table';

interface ExtractionFormSidebarProps {
  referenceId: number;
  reviewId: number;
  isOpen: boolean;
}

export function ExtractionFormSidebar({
  referenceId,
  reviewId,
  isOpen,
}: ExtractionFormSidebarProps) {
  // Fetch data
  const { data: questions = [] } = useFetchExtractionQuestions({});
  const { data: sections = [] } = useFetchExtractionSections({ reviewId });
  const { data: answers = [] } = useFetchExtractionAnswers({
    referenceId: referenceId,
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
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize local answers when data loads - ONLY ONCE
  useEffect(() => {
    if (questions.length > 0 && answers.length >= 0 && !hasInitialized) {
      const initial: Record<number, string> = {};

      for (const q of questions) {
        const existingAnswer = answers.find(
          (a) => a.question === q.id && a.reference === referenceId
        );
        initial[q.id] = existingAnswer?.value || '';
      }

      setLocalAnswers(initial);
      setInitialAnswers(initial);
      setHasInitialized(true);
    }
  }, [questions, answers, referenceId, hasInitialized]);

  // Reset initialization when referenceId changes
  useEffect(() => {
    setHasInitialized(false);
    setLocalAnswers({});
    setInitialAnswers({});
    setExpandedSections(new Set());
  }, [referenceId]);

  // Initialize expanded sections when sections load
  useEffect(() => {
    if (sections.length > 0 && expandedSections.size === 0) {
      setExpandedSections(new Set(sections.map((s) => s.id)));
    }
  }, [sections, expandedSections.size]);

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

  // Group questions by section
  const questionsBySection = useMemo(() => {
    const grouped: Record<number, ExtractionQuestion[]> = {};
    for (const section of sections) {
      grouped[section.id] = questions.filter((q) => q.section === section.id);
    }
    return grouped;
  }, [sections, questions]);

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
    setExpandedSections(new Set(sections.map((s) => s.id)));
  }, [sections]);

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

  const handleSave = useCallback(() => {
    if (!hasChanges) {
      return;
    }

    bulkSaveMutation.mutate(
      {
        referenceId: referenceId,
        answers: changedAnswers,
      },
      {
        onSuccess: () => {
          setInitialAnswers(localAnswers);
        },
      }
    );
  }, [hasChanges, changedAnswers, referenceId, localAnswers, bulkSaveMutation]);

  const handleMarkComplete = useCallback(async () => {
    // Save answers first if there are changes
    if (hasChanges) {
      await new Promise<void>((resolve, reject) => {
        bulkSaveMutation.mutate(
          {
            referenceId: referenceId,
            answers: changedAnswers,
          },
          {
            onSuccess: () => {
              resolve();
              setInitialAnswers(localAnswers);
            },
            onError: () => reject(),
          }
        );
      });
    }

    // Mark as completed
    bulkUpdateStatusMutation.mutate({
      referenceIds: [referenceId],
      isExtractionCompleted: true,
    });
  }, [
    hasChanges,
    changedAnswers,
    referenceId,
    bulkSaveMutation,
    bulkUpdateStatusMutation,
  ]);

  const isSaving =
    bulkSaveMutation.isPending || bulkUpdateStatusMutation.isPending;

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
          {sections.map((section) => {
            const sectionQuestions = questionsBySection[section.id] || [];
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
                        ({sectionQuestions.length})
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent className="mt-2">
                  <div className="space-y-3 pl-4 py-2">
                    {sectionQuestions.map((question) => {
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

                          <div className="relative">
                            <Input
                              placeholder="Enter your answer"
                              value={localAnswers[question.id] || ''}
                              onChange={(e) =>
                                handleAnswerChange(question.id, e.target.value)
                              }
                              className={cn(
                                'h-9 text-sm',
                                hasChanged && 'border-amber-500 bg-amber-50/50'
                              )}
                            />
                            {hasChanged && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <div className="h-2 w-2 rounded-full bg-amber-500" />
                              </div>
                            )}
                          </div>

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
            {sections.length} section(s)
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
