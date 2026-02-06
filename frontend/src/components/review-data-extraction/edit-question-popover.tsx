// components/edit-question-popover.tsx
'use client';

import React from 'react';

import { useState, useEffect } from 'react';
import { X, HelpCircle } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SectionSelect } from '@/components/review-data-extraction/section-select';
import type { ExtractionQuestion, QuestionType } from '@/types/extraction';
import {
  useUpdateExtractionQuestion,
  useDeleteExtractionQuestion,
} from '@/hooks/use-extraction-question';

interface EditQuestionPopoverProps {
  question: ExtractionQuestion;
  trigger: React.ReactNode;
  reviewId: number;
  onQuestionUpdated?: () => void;
  onQuestionDeleted?: () => void;
}

const questionTypes: { value: QuestionType; label: string }[] = [
  { value: 'free-text', label: 'Free Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'single-select', label: 'Single Select' },
  { value: 'multi-select', label: 'Multi Select' },
  { value: 'boolean', label: 'Yes/No' },
];

export function EditQuestionPopover({
  question,
  trigger,
  reviewId,
  onQuestionUpdated,
  onQuestionDeleted,
}: EditQuestionPopoverProps) {
  const [open, setOpen] = useState(false);
  const [sectionId, setSectionId] = useState<number | null>(question.section);
  const [questionText, setQuestionText] = useState(question.question);
  const [questionType, setQuestionType] = useState<QuestionType>(question.type);
  const [columnTitle, setColumnTitle] = useState(question.columnTitle);
  const [required, setRequired] = useState(question.required);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateQuestionMutation = useUpdateExtractionQuestion();
  const deleteQuestionMutation = useDeleteExtractionQuestion();

  // Reset form when question prop changes or popover opens
  useEffect(() => {
    if (open) {
      setSectionId(question.section);
      setQuestionText(question.question);
      setQuestionType(question.type);
      setColumnTitle(question.columnTitle);
      setRequired(question.required);
    }
  }, [open, question]);

  const handleSave = async () => {
    if (!sectionId || !questionText.trim() || !columnTitle.trim()) return;

    updateQuestionMutation.mutate(
      {
        questionId: question.id,
        payload: {
          section: sectionId,
          question: questionText.trim(),
          columnTitle: columnTitle.trim(),
          type: questionType,
          required,
        },
      },
      {
        onSuccess: () => {
          onQuestionUpdated?.();
          setOpen(false);
        },
      }
    );
  };

  const handleDelete = async () => {
    deleteQuestionMutation.mutate(
      {
        questionId: question.id,
        sectionId: question.section,
      },
      {
        onSuccess: () => {
          onQuestionDeleted?.();
          setOpen(false);
          setShowDeleteConfirm(false);
        },
      }
    );
  };

  const isValid =
    sectionId !== null && questionText.trim() && columnTitle.trim();

  return (
    <TooltipProvider>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <h3 className="font-semibold text-foreground">Edit Question</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4">
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
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
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
                  onValueChange={(val) => setQuestionType(val as QuestionType)}
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

              {/* Save */}
              <Button
                onClick={handleSave}
                disabled={!isValid || updateQuestionMutation.isPending}
                className="w-full"
              >
                {updateQuestionMutation.isPending
                  ? 'Saving...'
                  : 'Save Changes'}
              </Button>

              {/* Delete */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteQuestionMutation.isPending}
                className="w-full text-center text-sm font-medium text-foreground hover:text-destructive transition-colors disabled:opacity-50"
              >
                {deleteQuestionMutation.isPending
                  ? 'Deleting...'
                  : 'Delete Question'}
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the question &quot;
              {question.columnTitle}&quot;? This will also remove all associated
              answers. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteQuestionMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteQuestionMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
