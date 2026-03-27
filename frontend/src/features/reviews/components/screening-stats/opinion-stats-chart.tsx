// Pie/bar chart showing the distribution of member opinions.
import { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import type { OpinionStats } from '@/features/reviews/types/screening-stats';
import { CheckCircle, XCircle, HelpCircle, RotateCw } from 'lucide-react';

interface ReviewOpinionStatsChartProps {
  opinions: OpinionStats[];
  stage: 'screening' | 'full-text';
}

export function ReviewOpinionStatsChart({
  opinions,
  stage,
}: ReviewOpinionStatsChartProps) {
  const [isVertical, setIsVertical] = useState(true);

  const chartData = useMemo(() => {
    return opinions.map((opinion) => ({
      name: opinion.userName,
      email: opinion.userEmail,
      included: opinion.included,
      maybe: opinion.maybe,
      excluded: opinion.excluded,
      total: opinion.total,
    }));
  }, [opinions]);

  const chartConfig = {
    included: {
      label: 'Included',
      color: 'hsl(var(--color-green-600))',
    },
    maybe: {
      label: 'Maybe',
      color: 'hsl(var(--color-amber-600))',
    },
    excluded: {
      label: 'Excluded',
      color: 'hsl(var(--color-red-500))',
    },
  } satisfies ChartConfig;

  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, item) => ({
        included: acc.included + item.included,
        maybe: acc.maybe + item.maybe,
        excluded: acc.excluded + item.excluded,
        total: acc.total + item.total,
      }),
      { included: 0, maybe: 0, excluded: 0, total: 0 }
    );
  }, [chartData]);

  const stageLabel =
    stage === 'screening' ? 'Title/Abstract Screening' : 'Full-Text Screening';

  if (opinions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{stageLabel} Opinions</CardTitle>
          <CardDescription>Review decisions by team members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>No opinions recorded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg sm:text-xl">
              {stageLabel} Opinions
            </CardTitle>
            <CardDescription>Review decisions by team members</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsVertical(!isVertical)}
            className="gap-2 w-full sm:w-auto"
          >
            <RotateCw className="h-4 w-4" />
            {isVertical ? 'Switch to Horizontal' : 'Switch to Vertical'}
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:gap-6 gap-4 mt-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Included
              </p>
              <p className="text-xl sm:text-2xl font-bold">{totals.included}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Maybe</p>
              <p className="text-xl sm:text-2xl font-bold">{totals.maybe}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Excluded
              </p>
              <p className="text-xl sm:text-2xl font-bold">{totals.excluded}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
              <p className="text-xl sm:text-2xl font-bold">{totals.total}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {isVertical ? (
          // Vertical (Horizontal bars) - DEFAULT
          <ChartContainer
            config={chartConfig}
            className="h-[300px] sm:h-[400px] w-full"
          >
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{
                top: 20,
                right: 10,
                bottom: 20,
                left: 10,
              }}
              barSize={40}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                width={80}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
              />
              <ChartLegend
                content={({ payload }) => (
                  <ChartLegendContent payload={payload} />
                )}
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Bar
                dataKey="included"
                stackId="a"
                fill="var(--color-green-600)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="maybe"
                stackId="a"
                fill="var(--color-amber-600)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="excluded"
                stackId="a"
                fill="var(--color-red-500)"
                radius={[0, 8, 8, 0]}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          // Horizontal (Vertical bars)
          <ChartContainer
            config={chartConfig}
            className="h-[300px] sm:h-[400px] w-full"
          >
            <BarChart
              data={chartData}
              margin={{
                top: 20,
                right: 10,
                bottom: 60,
                left: 10,
              }}
              barSize={40}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
              />
              <ChartLegend
                content={({ payload }) => (
                  <ChartLegendContent payload={payload} />
                )}
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Bar
                dataKey="included"
                stackId="a"
                fill="var(--color-green-600)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="maybe"
                stackId="a"
                fill="var(--color-amber-600)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="excluded"
                stackId="a"
                fill="var(--color-red-500)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
