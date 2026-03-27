// Shared form fields for the add/edit question popovers.
import { HelpCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SectionSelect } from '@/features/extraction/components/data-extraction/section-select';
import type { QuestionType } from '@/features/extraction/types/extraction';
import type { useQuestionForm } from '@/features/extraction/hooks/use-question-form';

const questionTypes: { value: QuestionType; label: string }[] = [
  { value: 'free-text', label: 'Free Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'single-select', label: 'Single Select' },
  { value: 'multi-select', label: 'Multi Select' },
  { value: 'boolean', label: 'Yes/No' },
];

function FieldLabel({
  label,
  required,
  tooltip,
}: {
  label: string;
  required?: boolean;
  tooltip: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

interface QuestionFormFieldsProps {
  reviewId: number;
  form: ReturnType<typeof useQuestionForm>;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: () => void;
  /** Optional extra content rendered below the submit button (e.g. delete button) */
  footer?: React.ReactNode;
}

export function QuestionFormFields({
  reviewId,
  form,
  submitLabel,
  isSubmitting,
  onSubmit,
  footer,
}: QuestionFormFieldsProps) {
  const {
    sectionId,
    question,
    questionType,
    columnTitle,
    required,
    options,
    setSectionId,
    setQuestion,
    setColumnTitle,
    setRequired,
    handleTypeChange,
    handleAddOption,
    handleRemoveOption,
    handleOptionChange,
    needsOptions,
    isValid,
  } = form;

  return (
    <div className="p-4 space-y-4">
      {/* Section */}
      <div className="space-y-2">
        <FieldLabel
          label="Section"
          required
          tooltip="Group questions by section for better organization"
        />
        <SectionSelect
          reviewId={reviewId}
          value={sectionId}
          onChange={setSectionId}
          placeholder="Select section..."
        />
      </div>

      {/* Question */}
      <div className="space-y-2">
        <FieldLabel
          label="Question"
          required
          tooltip="The question to ask about each article"
        />
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question here"
          className="min-h-[60px] resize-y"
        />
      </div>

      {/* Type */}
      <div className="space-y-2">
        <FieldLabel
          label="Type"
          required
          tooltip="The type of answer expected"
        />
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

      {/* Options (select types only) */}
      {needsOptions && (
        <div className="space-y-2">
          <FieldLabel
            label="Options"
            required
            tooltip="List of choices for this question"
          />
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
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
        <FieldLabel
          label="Column Title"
          required
          tooltip="Short title displayed in the table column header"
        />
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
        onClick={onSubmit}
        disabled={!isValid || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? 'Saving...' : submitLabel}
      </Button>

      {footer}
    </div>
  );
}
