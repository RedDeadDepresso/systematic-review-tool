import { useState } from 'react';
import { Grid3x3, AlertCircle, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFetchExtractionQuestions } from '@/hooks/use-extraction-question';
import { useFetchEvidenceGapMap } from '@/hooks/use-chart';
import { useTheme } from '../shared/theme-provider';

interface EvidenceGapMapPanelProps {
  reviewId: number;
}

export function EvidenceGapMapPanel({ reviewId }: EvidenceGapMapPanelProps) {
  const { theme } = useTheme();
  const [qRow, setQRow] = useState<string>('');
  const [qCol, setQCol] = useState<string>('');
  const [tooltip, setTooltip] = useState<{
    cell: any;
    x: number;
    y: number;
  } | null>(null);

  // Fetch select-type questions only
  const { data: selectQuestions = [], isLoading: questionsLoading } =
    useFetchExtractionQuestions({
      reviewId,
      type: ['single-select', 'multi-select'],
    });

  const parsedQRow = qRow ? parseInt(qRow, 10) : null;
  const parsedQCol = qCol ? parseInt(qCol, 10) : null;

  const { data, isLoading, error } = useFetchEvidenceGapMap(
    parsedQRow,
    parsedQCol,
    reviewId
  );

  const maxCount = data?.maxCount || 1;

  const bubbleColor = (count: number) => {
    if (count === 0)
      return {
        bg: 'var(--muted)',
        border: 'var(--border)',
        text: 'var(--muted-foreground)',
      };
    const intensity = count / maxCount;
    if (intensity < 0.33)
      return { bg: '#DBEAFE', border: '#93C5FD', text: '#1D4ED8' };
    if (intensity < 0.66)
      return { bg: '#BFDBFE', border: '#3B82F6', text: '#1E40AF' };
    return {
      bg: 'var(--primary)',
      border: '#1D4ED8',
      text: 'var(--primary-foreground)',
    };
  };

  const rows = data?.questionRow.options || [];
  const cols = data?.questionCol.options || [];

  // Dynamic cell size based on number of options (larger when fewer options)
  const calculateCellSize = () => {
    const maxOptions = Math.max(rows.length, cols.length);
    if (maxOptions <= 3) return 120; // Very large for 3 or fewer
    if (maxOptions <= 5) return 100; // Large for 4-5
    if (maxOptions <= 7) return 80; // Medium for 6-7
    return 60; // Default for 8+
  };

  const CELL_SIZE = calculateCellSize();
  const LABEL_WIDTH = CELL_SIZE * 2.5; // Scale label width proportionally

  const cellMap: Record<string, any> = {};
  (data?.cells || []).forEach((c) => {
    cellMap[`${c.row}|${c.col}`] = c;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid3x3 className="h-5 w-5 text-primary" />
          Evidence Gap Map
        </CardTitle>
        <CardDescription>
          Density matrix for two option-type questions —{' '}
          {theme === 'light' ? 'darker' : 'lighter'} = more evidence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-2 w-64">
            <Label htmlFor="gap-row">Row Question</Label>
            <Select value={qRow} onValueChange={setQRow}>
              <SelectTrigger id="gap-row">
                <SelectValue placeholder="Select row question..." />
              </SelectTrigger>
              <SelectContent>
                {questionsLoading && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!questionsLoading && selectQuestions.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No select questions found
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
          <div className="space-y-2 w-64">
            <Label htmlFor="gap-col">Column Question</Label>
            <Select value={qCol} onValueChange={setQCol}>
              <SelectTrigger id="gap-col">
                <SelectValue placeholder="Select column question..." />
              </SelectTrigger>
              <SelectContent>
                {questionsLoading && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!questionsLoading && selectQuestions.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No select questions found
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

        {!isLoading && data && rows.length > 0 && cols.length > 0 && (
          <div className="overflow-x-auto">
            {/* Column labels */}
            <div
              className="flex mb-1"
              style={{ marginLeft: `${LABEL_WIDTH}px` }}
            >
              {cols.map((col) => (
                <div
                  key={col}
                  style={{ width: CELL_SIZE, minWidth: CELL_SIZE }}
                  className="text-center text-sm text-muted-foreground font-medium truncate px-1 leading-tight"
                  title={col}
                >
                  {col.length > 12 ? col.slice(0, 11) + '…' : col}
                </div>
              ))}
            </div>
            <p
              className="text-center text-xs font-semibold text-muted-foreground mb-3 tracking-wide uppercase"
              style={{ marginLeft: `${LABEL_WIDTH}px` }}
            >
              {data.questionCol.columnTitle}
            </p>

            <div className="flex gap-0">
              {/* Row labels */}
              <div className="flex flex-col">
                <div style={{ height: 12 }} />
                {rows.map((row) => (
                  <div
                    key={row}
                    style={{ height: CELL_SIZE, width: LABEL_WIDTH }}
                    className="flex items-center justify-end pr-4 text-sm text-foreground font-medium leading-tight text-right"
                  >
                    <span className="truncate" title={row}>
                      {row.length > 24 ? row.slice(0, 23) + '…' : row}
                    </span>
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="relative">
                {rows.map((row) => (
                  <div key={row} className="flex">
                    {cols.map((col) => {
                      const cell = cellMap[`${row}|${col}`] || {
                        count: 0,
                        references: [],
                      };
                      const { bg, border, text } = bubbleColor(cell.count);
                      // Scale bubble radius with cell size
                      const bubbleR =
                        cell.count === 0
                          ? Math.max(12, CELL_SIZE * 0.2)
                          : Math.max(16, CELL_SIZE * 0.25) +
                            Math.round(
                              CELL_SIZE * 0.25 * (cell.count / maxCount)
                            );
                      return (
                        <div
                          key={col}
                          style={{
                            width: CELL_SIZE,
                            height: CELL_SIZE,
                            minWidth: CELL_SIZE,
                          }}
                          className="flex items-center justify-center border border-border/40 relative"
                          onMouseEnter={(e) => {
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            setTooltip({
                              cell: { ...cell, row, col },
                              x: rect.left + CELL_SIZE / 2,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          <div
                            className="flex items-center justify-center font-bold transition-transform hover:scale-110 cursor-default"
                            style={{
                              width: bubbleR * 2,
                              height: bubbleR * 2,
                              borderRadius: '50%',
                              background: bg,
                              border: `2px solid ${border}`,
                              color: text,
                              // Scale font size with cell size
                              fontSize: Math.min(
                                cell.count > 9 ? 14 : 16,
                                CELL_SIZE * 0.3
                              ),
                            }}
                          >
                            {cell.count > 0 ? cell.count : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Y-axis label rotated */}
              <div className="flex items-center ml-4">
                <span
                  className="text-xs font-semibold text-muted-foreground tracking-wide uppercase"
                  style={{
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                  }}
                >
                  {data.questionRow.columnTitle}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div
              className="flex items-center gap-4 mt-6"
              style={{ marginLeft: `${LABEL_WIDTH}px` }}
            >
              <span className="text-sm text-muted-foreground font-medium">
                Evidence:
              </span>
              {[
                { label: 'None', count: 0 },
                { label: 'Low', count: Math.round(maxCount * 0.25) },
                { label: 'Mid', count: Math.round(maxCount * 0.6) },
                { label: 'High', count: maxCount },
              ].map(({ label, count }) => {
                const { bg, border, text } = bubbleColor(count);
                const legendSize = Math.max(24, CELL_SIZE * 0.35);
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div
                      style={{
                        background: bg,
                        border: `2px solid ${border}`,
                        color: text,
                        width: legendSize,
                        height: legendSize,
                      }}
                      className="rounded-full flex items-center justify-center text-xs font-bold"
                    >
                      {count > 0 ? count : ''}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isLoading && data && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Grid3x3 className="h-12 w-12 opacity-20" />
            <p className="text-sm">
              No options found for the selected question
            </p>
          </div>
        )}

        {!isLoading && !data && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Grid3x3 className="h-12 w-12 opacity-20" />
            <p className="text-sm">
              Select two option-type questions to generate the evidence map
            </p>
          </div>
        )}

        {/* Floating tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none bg-popover border border-border shadow-lg rounded-lg px-3 py-2 text-sm"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 8,
              transform: 'translateY(-100%)',
            }}
          >
            <p className="font-semibold text-foreground mb-1">
              {tooltip.cell.row} x {tooltip.cell.col}
            </p>
            <p className="text-muted-foreground text-xs mb-1.5">
              {tooltip.cell.count} reference
              {tooltip.cell.count !== 1 ? 's' : ''}
            </p>
            {tooltip.cell.references.slice(0, 5).map((r: any) => (
              <p
                key={r.id}
                className="text-xs text-muted-foreground truncate max-w-[220px]"
              >
                · {r.title || `Ref #${r.id}`}
              </p>
            ))}
            {tooltip.cell.references.length > 5 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                +{tooltip.cell.references.length - 5} more
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
