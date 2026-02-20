import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { AlertCircle, Loader2, TrendingUp } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFetchPublicationTimeline } from '@/features/extraction/hooks/use-charts';

const CustomLineTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { year, count } = payload[0].payload;
  return (
    <div className="bg-popover border border-border shadow-md rounded-lg px-3 py-2 text-sm">
      <p className="font-semibold text-foreground">{year}</p>
      <p className="text-muted-foreground text-xs mt-0.5">
        {count} reference{count !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

interface PublicationTimelinePanelProps {
  reviewId: number;
}

export function PublicationTimelinePanel({
  reviewId,
}: PublicationTimelinePanelProps) {
  const { data, isLoading, error } = useFetchPublicationTimeline(reviewId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Publication Timeline
        </CardTitle>
        <CardDescription>
          References by publication year in extraction phase
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {!isLoading && data && data.data.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Total References
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {data.totalReferences}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Year Range</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {data.yearRange
                    ? `${data.yearRange.min} - ${data.yearRange.max}`
                    : 'N/A'}
                </p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={340}>
              <LineChart
                data={data.data}
                margin={{ top: 16, right: 24, bottom: 8, left: -8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  label={{
                    value: 'Publication Year',
                    position: 'insideBottom',
                    offset: -4,
                    fontSize: 12,
                    className: 'fill-muted-foreground',
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  allowDecimals={false}
                  label={{
                    value: 'Number of References',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 12,
                    fontSize: 12,
                    className: 'fill-muted-foreground',
                  }}
                />
                <Tooltip content={<CustomLineTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>

            <p className="text-center text-xs text-muted-foreground">
              {data.data.length} year{data.data.length !== 1 ? 's' : ''} with
              published references
            </p>
          </div>
        )}

        {!isLoading && data && data.data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <TrendingUp className="h-12 w-12 opacity-20" />
            <p className="text-sm">
              No references with publication dates found in extraction
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
