'use client';

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
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import type { ScreeningStat } from '@/types/screening-stat';
import { Clock, Activity, RotateCw } from 'lucide-react';

interface ReviewScreeningStatsChartProps {
  stats: ScreeningStat[];
}

export function ReviewScreeningStatsChart({
  stats,
}: ReviewScreeningStatsChartProps) {
  const [isVertical, setIsVertical] = useState(true);

  const chartData = useMemo(() => {
    return stats.map((stat) => ({
      name: stat.userName,
      email: stat.userEmail,
      hours: stat.hours,
      sessions: stat.sessions,
      seconds: stat.seconds,
    }));
  }, [stats]);

  const chartConfig = {
    hours: {
      label: 'Hours',
      color: 'hsl(var(--chart-1))',
    },
  } satisfies ChartConfig;

  const totalHours = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.hours, 0).toFixed(1);
  }, [chartData]);

  const totalSessions = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.sessions, 0);
  }, [chartData]);

  if (stats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Screening Time Statistics</CardTitle>
          <CardDescription>
            Time spent by team members on screening
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>No screening activity recorded yet</p>
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
            <CardTitle>Screening Time Statistics</CardTitle>
            <CardDescription>
              Time spent by team members on screening
            </CardDescription>
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
        <div className="grid grid-cols-2 sm:flex sm:gap-6 gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Total Time
              </p>
              <p className="text-xl sm:text-2xl font-bold">{totalHours}h</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Total Sessions
              </p>
              <p className="text-xl sm:text-2xl font-bold">{totalSessions}</p>
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
                label={{
                  value: 'Hours',
                  position: 'insideBottom',
                  offset: -10,
                  style: { fontSize: 12 },
                }}
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
                labelFormatter={(value, payload) => {
                  const item = payload[0]?.payload;
                  return (
                    <div>
                      <div className="font-semibold text-sm">{value}</div>
                      <div className="text-xs text-muted-foreground">
                        {item?.email}
                      </div>
                    </div>
                  );
                }}
                formatter={(value, _, props) => {
                  const sessions = props.payload.sessions;
                  return (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3 w-3" />
                        <span className="font-medium">{value} hours</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Activity className="h-3 w-3" />
                        <span>{sessions} sessions</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="hours"
                fill="var(--color-primary)"
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
                label={{
                  value: 'Hours',
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fontSize: 12 },
                }}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                labelFormatter={(value, payload) => {
                  const item = payload[0]?.payload;
                  return (
                    <div>
                      <div className="font-semibold text-sm">{value}</div>
                      <div className="text-xs text-muted-foreground">
                        {item?.email}
                      </div>
                    </div>
                  );
                }}
                formatter={(value, _, props) => {
                  const sessions = props.payload.sessions;
                  return (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3 w-3" />
                        <span className="font-medium">{value} hours</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Activity className="h-3 w-3" />
                        <span>{sessions} sessions</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="hours"
                fill="var(--color-primary)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
