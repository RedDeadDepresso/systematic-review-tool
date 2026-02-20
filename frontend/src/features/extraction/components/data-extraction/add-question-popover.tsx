'use client';

import React from 'react';

import { useState } from 'react';
import { X, HelpCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { SectionSelect } from '@/features/extraction/components/data-extraction/section-select';
import type { QuestionType } from '@/features/extraction/types/extraction';
import { useCreateExtractionQuestion } from '@/features/extraction/hooks/use-extraction-questions';

interface AddQuestionPopoverProps {
  trigger: React.ReactNode;
  onQuestionAdded?: () => void;
  reviewId: number;
}

const questionTypes: { value: QuestionType; label: string }[] = [
  { value: 'free-text', label: 'Free Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'single-select', label: 'Single Select' },
  { value: 'multi-select', label: 'Multi Select' },
  { value: 'boolean', label: 'Yes/No' },
];

export function AddQuestionPopover({
  trigger,
  onQuestionAdded,
  reviewId,
}: AddQuestionPopoverProps) {
  const [open, setOpen] = useState(false);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [question, setQuestion] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('free-text');
  const [columnTitle, setColumnTitle] = useState('');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<string[]>(['']);

  const createQuestionMutation = useCreateExtractionQuestion();

  const resetForm = () => {
    setSectionId(null);
    setQuestion('');
    setQuestionType('free-text');
    setColumnTitle('');
    setRequired(false);
    setOptions(['']);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForm();
    }
  };

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 1) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleTypeChange = (newType: QuestionType) => {
    setQuestionType(newType);
    // Initialize options array when switching to select types
    if (
      (newType === 'single-select' || newType === 'multi-select') &&
      options.length === 0
    ) {
      setOptions(['']);
    }
  };

  const handleSubmit = async () => {
    if (!sectionId || !question.trim() || !columnTitle.trim()) return;

    // Validate options for select types
    const needsOptions =
      questionType === 'single-select' || questionType === 'multi-select';
    const validOptions = options.filter((opt) => opt.trim().length > 0);

    if (needsOptions && validOptions.length === 0) return;

    createQuestionMutation.mutate(
      {
        section: sectionId,
        question: question.trim(),
        columnTitle: columnTitle.trim(),
        type: questionType,
        required,
        ...(needsOptions && { options: validOptions }),
      },
      {
        onSuccess: () => {
          onQuestionAdded?.();
          setOpen(false);
          resetForm();
        },
      }
    );
  };

  const needsOptions =
    questionType === 'single-select' || questionType === 'multi-select';
  const validOptions = options.filter((opt) => opt.trim().length > 0);
  const isValid =
    sectionId !== null &&
    question.trim() &&
    columnTitle.trim() &&
    (!needsOptions || validOptions.length > 0);

  return (
    <TooltipProvider>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex flex-col max-h-[600px]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <h3 className="font-semibold text-foreground">Add Question</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">
                    Section <span className="text-destructive">*</span>
                  </label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Group questions by section for better organization</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <SectionSelect
                  reviewId={reviewId}
                  value={sectionId}
                  onChange={setSectionId}
                  placeholder="Select section..."
                />
              </div>

              {/* Question */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">
                    Question <span className="text-destructive">*</span>
                  </label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The question to ask about each article</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Type your question here"
                  className="min-h-[60px] resize-y"
                />
              </div>

              {/* Type */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">
                    Type <span className="text-destructive">*</span>
                  </label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The type of answer expected</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={questionType}
                  onValueChange={(val) => handleTypeChange(val as QuestionType)}
                >
                  <SelectTrigger className="bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {questionTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Options (for select types) */}
              {needsOptions && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      Options <span className="text-destructive">*</span>
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>List of choices for this question</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="space-y-2">
                    {options.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={option}
                          onChange={(e) =>
                            handleOptionChange(index, e.target.value)
                          }
                          placeholder={`Option ${index + 1}`}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveOption(index)}
                          disabled={options.length === 1}
                          className="shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddOption}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                </div>
              )}

              {/* Column Title */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">
                    Column Title <span className="text-destructive">*</span>
                  </label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Short title displayed in the table column header</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  value={columnTitle}
                  onChange={(e) => setColumnTitle(e.target.value)}
                  placeholder="Add column title"
                />
              </div>

              {/* Required */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Required Question
                </label>
                <Switch checked={required} onCheckedChange={setRequired} />
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={!isValid || createQuestionMutation.isPending}
                className="w-full"
              >
                {createQuestionMutation.isPending ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
