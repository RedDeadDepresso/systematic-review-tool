// Popover for editing an existing extraction question.
import { useState, useEffect } from 'react';
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
import { QuestionPopoverShell } from '@/features/extraction/components/data-extraction/question-popover-shell';
import { QuestionFormFields } from '@/features/extraction/components/data-extraction/question-form-fields';
import { useQuestionForm } from '@/features/extraction/hooks/use-question-form';
import type { ExtractionQuestion } from '@/features/extraction/types/extraction';
import {
  useUpdateExtractionQuestion,
  useDeleteExtractionQuestion,
} from '@/features/extraction/hooks/use-extraction-questions';

interface EditQuestionPopoverProps {
  question: ExtractionQuestion;
  trigger: React.ReactNode;
  reviewId: number;
  onQuestionUpdated?: () => void;
  onQuestionDeleted?: () => void;
}

export function EditQuestionPopover({
  question,
  trigger,
  reviewId,
  onQuestionUpdated,
  onQuestionDeleted,
}: EditQuestionPopoverProps) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const form = useQuestionForm({
    sectionId: question.section,
    question: question.question,
    questionType: question.type,
    columnTitle: question.columnTitle,
    required: question.required,
    options: question.options?.length ? question.options : [''],
  });

  const updateQuestionMutation = useUpdateExtractionQuestion();
  const deleteQuestionMutation = useDeleteExtractionQuestion();

  // Sync form back to the latest question prop each time the popover opens
  useEffect(() => {
    if (open) {
      form.reset({
        sectionId: question.section,
        question: question.question,
        questionType: question.type,
        columnTitle: question.columnTitle,
        required: question.required,
        options: question.options?.length ? question.options : [''],
      });
    }
  }, [open]);

  const handleOpenChange = (isOpen: boolean) => setOpen(isOpen);

  const handleSave = () => {
    if (!form.isValid) return;

    updateQuestionMutation.mutate(
      {
        questionId: question.id,
        payload: {
          section: form.sectionId!,
          question: form.question.trim(),
          columnTitle: form.columnTitle.trim(),
          type: form.questionType,
          required: form.required,
          ...(form.needsOptions && { options: form.validOptions }),
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

  const handleDelete = () => {
    deleteQuestionMutation.mutate(
      { questionId: question.id, sectionId: question.section },
      {
        onSuccess: () => {
          onQuestionDeleted?.();
          setOpen(false);
          setShowDeleteConfirm(false);
        },
      }
    );
  };

  return (
    <>
      <QuestionPopoverShell
        trigger={trigger}
        title="Edit Question"
        open={open}
        onOpenChange={handleOpenChange}
        align="start"
      >
        <QuestionFormFields
          reviewId={reviewId}
          form={form}
          submitLabel="Save Changes"
          isSubmitting={updateQuestionMutation.isPending}
          onSubmit={handleSave}
          footer={
            <div className="px-4 pb-4">
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
          }
        />
      </QuestionPopoverShell>

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
    </>
  );
}
