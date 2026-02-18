import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { BarChart3, AlertCircle, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFetchBarChart } from '@/hooks/use-chart';
import { useFetchExtractionQuestions } from '@/hooks/use-extraction-question';

export const PALETTE = [
  '#2563EB',
  '#7C3AED',
  '#059669',
  '#D97706',
  '#DC2626',
  '#0891B2',
  '#9333EA',
  '#16A34A',
  '#EA580C',
  '#BE123C',
];

export const CustomBarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { label, count } = payload[0].payload;
  return (
    <div className="bg-popover border border-border shadow-md rounded-lg px-3 py-2 text-sm">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground text-xs mt-0.5">
        {count} answer{count !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

interface BarChartPanelProps {
  reviewId: number;
}

export function BarChartPanel({ reviewId }: BarChartPanelProps) {
  const [questionId, setQuestionId] = useState<string>('');

  // Fetch questions filtered by type for bar charts (select/boolean only)
  const { data: selectQuestions = [], isLoading: questionsLoading } =
    useFetchExtractionQuestions({
      reviewId,
      type: ['single-select', 'multi-select', 'boolean'],
    });

  const parsedQId = questionId ? parseInt(questionId, 10) : null;
  const { data, isLoading, error } = useFetchBarChart(parsedQId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Frequency Bar Chart
        </CardTitle>
        <CardDescription>
          Count of answers per option for a select/boolean question
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="space-y-2 w-64">
            <Label htmlFor="bar-question-select">Question</Label>
            <Select value={questionId} onValueChange={setQuestionId}>
              <SelectTrigger id="bar-question-select">
                <SelectValue placeholder="Select a question..." />
              </SelectTrigger>
              <SelectContent>
                {questionsLoading && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!questionsLoading && selectQuestions.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No select/boolean questions found
                  </div>
                )}
                {selectQuestions.map((q) => (
                  <SelectItem key={q.id} value={q.id.toString()}>
                    <div className="flex flex-col">
                      <span className="font-medium">{q.columnTitle}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                        {q.question}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && data && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">
              {data.question}
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.data}
                margin={{ top: 8, right: 16, left: -12, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  allowDecimals={false}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.data.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2">
              {data.data.map((d, i) => (
                <Badge key={d.label} variant="secondary" className="gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: PALETTE[i % PALETTE.length] }}
                  />
                  {d.label}: {d.count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {!isLoading && !data && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <BarChart3 className="h-12 w-12 opacity-20" />
            <p className="text-sm">
              Select a question above to visualise its answer distribution
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
