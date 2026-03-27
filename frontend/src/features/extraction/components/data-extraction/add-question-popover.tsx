// Popover for adding a new extraction question column.
import { useState } from 'react';
import { QuestionPopoverShell } from '@/features/extraction/components/data-extraction/question-popover-shell';
import { QuestionFormFields } from '@/features/extraction/components/data-extraction/question-form-fields';
import { useQuestionForm } from '@/features/extraction/hooks/use-question-form';
import { useCreateExtractionQuestion } from '@/features/extraction/hooks/use-extraction-questions';

interface AddQuestionPopoverProps {
  trigger: React.ReactNode;
  onQuestionAdded?: () => void;
  reviewId: number;
}

export function AddQuestionPopover({
  trigger,
  onQuestionAdded,
  reviewId,
}: AddQuestionPopoverProps) {
  const [open, setOpen] = useState(false);
  const form = useQuestionForm();
  const createQuestionMutation = useCreateExtractionQuestion();

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) form.reset();
    setOpen(isOpen);
  };

  const handleSubmit = () => {
    if (!form.isValid) return;

    createQuestionMutation.mutate(
      {
        section: form.sectionId!,
        question: form.question.trim(),
        columnTitle: form.columnTitle.trim(),
        type: form.questionType,
        required: form.required,
        ...(form.needsOptions && { options: form.validOptions }),
      },
      {
        onSuccess: () => {
          onQuestionAdded?.();
          setOpen(false);
          form.reset();
        },
      }
    );
  };

  return (
    <QuestionPopoverShell
      trigger={trigger}
      title="Add Question"
      open={open}
      onOpenChange={handleOpenChange}
      align="end"
    >
      <QuestionFormFields
        reviewId={reviewId}
        form={form}
        submitLabel="Add"
        isSubmitting={createQuestionMutation.isPending}
        onSubmit={handleSubmit}
      />
    </QuestionPopoverShell>
  );
}
