// Scatter plot panel for extraction data.
import { useState } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import {
  ScatterChart as ScatterChartIcon,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFetchExtractionQuestions } from '@/features/extraction/hooks/use-extraction-questions';
import { useFetchScatterPlot } from '@/features/extraction/hooks/use-charts';
import type { ExtractionQuestion } from '@/features/extraction/types/extraction';

const CustomScatterTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border shadow-md rounded-lg px-3 py-2 text-sm max-w-xs">
      <p className="font-semibold text-foreground truncate">
        {d.title || `Ref #${d.referenceId}`}
      </p>
      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <span>
          X: <strong className="text-foreground">{d.x}</strong>
        </span>
        <span>
          Y: <strong className="text-foreground">{d.y}</strong>
        </span>
        {d.bubbleSize > 1 && (
          <span className="col-span-2">
            Overlapping:{' '}
            <strong className="text-foreground">{d.bubbleSize}</strong>
          </span>
        )}
      </div>
    </div>
  );
};

interface ScatterPlotPanelProps {
  reviewId: number;
}

export function ScatterPlotPanel({ reviewId }: ScatterPlotPanelProps) {
  const [qX, setQX] = useState<string>('');
  const [qY, setQY] = useState<string>('');
  const [mode, setMode] = useState<'scatter' | 'bubble'>('scatter');

  // Fetch numeric questions only
  const { data: questions, isLoading: questionsLoading } =
    useFetchExtractionQuestions({ reviewId, type: ['number'] });

  const parsedQX = qX ? parseInt(qX, 10) : null;
  const parsedQY = qY ? parseInt(qY, 10) : null;

  const { data, isLoading, error } = useFetchScatterPlot(
    parsedQX,
    parsedQY,
    reviewId
  );

  const zDomain: [number, number] = data
    ? [1, Math.max(...data.data.map((d) => d.bubbleSize), 2)]
    : [1, 2];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScatterChartIcon className="h-5 w-5 text-primary" />
              Scatter / Bubble Plot
            </CardTitle>
            <CardDescription>
              Compare two numeric extraction questions across references
            </CardDescription>
          </div>
          {data && (
            <div className="flex gap-2">
              <Button
                variant={mode === 'scatter' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('scatter')}
              >
                Scatter
              </Button>
              <Button
                variant={mode === 'bubble' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('bubble')}
              >
                Bubble
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-2 w-64">
            <Label htmlFor="scatter-x">X-Axis Question</Label>
            <Select value={qX} onValueChange={setQX}>
              <SelectTrigger id="scatter-x">
                <SelectValue placeholder="Select X question..." />
              </SelectTrigger>
              <SelectContent>
                {questionsLoading && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!questionsLoading && questions?.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No numeric questions found
                  </div>
                )}
                {questions?.map((q: ExtractionQuestion) => (
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
          <div className="space-y-2 w-64">
            <Label htmlFor="scatter-y">Y-Axis Question</Label>
            <Select value={qY} onValueChange={setQY}>
              <SelectTrigger id="scatter-y">
                <SelectValue placeholder="Select Y question..." />
              </SelectTrigger>
              <SelectContent>
                {questionsLoading && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!questionsLoading && questions?.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No numeric questions found
                  </div>
                )}
                {questions?.map((q: ExtractionQuestion) => (
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
          <div className="space-y-2">
            <ResponsiveContainer width="100%" height={340}>
              <ScatterChart
                margin={{ top: 16, right: 24, bottom: 8, left: -8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="x"
                  type="number"
                  name={data.questionX.columnTitle}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  label={{
                    value: data.questionX.columnTitle,
                    position: 'insideBottom',
                    offset: -4,
                    fontSize: 12,
                    className: 'fill-muted-foreground',
                  }}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name={data.questionY.columnTitle}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  label={{
                    value: data.questionY.columnTitle,
                    angle: -90,
                    position: 'insideLeft',
                    offset: 12,
                    fontSize: 12,
                    className: 'fill-muted-foreground',
                  }}
                />
                {mode === 'bubble' && (
                  <ZAxis
                    dataKey="bubbleSize"
                    range={[60, 600]}
                    domain={zDomain}
                    name="Count"
                  />
                )}
                <Tooltip
                  content={<CustomScatterTooltip />}
                  cursor={{ strokeDasharray: '3 3' }}
                />
                <Scatter
                  data={data.data}
                  fill="var(--color-primary)"
                  fillOpacity={mode === 'bubble' ? 0.55 : 0.85}
                />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-center text-xs text-muted-foreground">
              {data.data.length} reference{data.data.length !== 1 ? 's' : ''}{' '}
              plotted
              {mode === 'bubble' &&
                ' · bubble size = number of overlapping points'}
            </p>
          </div>
        )}

        {!isLoading && !data && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <ScatterChartIcon className="h-12 w-12 opacity-20" />
            <p className="text-sm">
              Select two numeric questions to plot a scatter chart
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
