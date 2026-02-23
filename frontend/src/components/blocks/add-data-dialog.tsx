import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAddData,
  useFetchArticleCounts,
} from '@/features/reviews/hooks/use-reviews';
import type { Stage } from '@/features/references/types/references';

type ArticleType = 'included' | 'maybe' | 'labeled';

type DataSink = 'full-text' | 'extraction';

interface AddDataDialogProps {
  reviewId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
  dataSources: Stage[];
  dataSink: DataSink;
}

const DataSourceSinkLabel: Record<Stage | DataSink, string> = {
  screening: 'Screening',
  'full-text': 'Full-Text Screening',
  extraction: 'Data Extraction',
};

export function AddDataDialog({
  reviewId,
  open,
  onOpenChange,
  onAdd,
  dataSources,
  dataSink,
}: AddDataDialogProps) {
  const [dataSource, setDataSource] = useState<Stage>(dataSources[0]);
  const {
    data: articleCounts = { included: 0, maybe: 0, labeled: 0, labels: [] },
  } = useFetchArticleCounts(reviewId, { stage: dataSource });
  const labels = articleCounts.labels;
  const [selectedTypes, setSelectedTypes] = useState<ArticleType[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([]);
  const [labelSearchQuery, setLabelSearchQuery] = useState('');
  const addData = useAddData(reviewId);

  const handleTypeToggle = (type: ArticleType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleLabelToggle = (labelId: number) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleAdd = async () => {
    try {
      await addData.mutateAsync({
        dataSource,
        dataSink,
        articleTypes: selectedTypes,
        labelIds: selectedLabelIds,
      });
      onAdd();
      onOpenChange(false);
      // Reset state
      setSelectedTypes([]);
      setSelectedLabelIds([]);
      setLabelSearchQuery('');
    } catch (error) {
      console.error('Error adding data', error);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSelectedTypes([]);
    setSelectedLabelIds([]);
    setLabelSearchQuery('');
  };

  const isLabeledSelected = selectedTypes.includes('labeled');

  const filteredLabels = useMemo(() => {
    if (!labelSearchQuery.trim()) return labels;
    return labels.filter((label) =>
      label.name.toLowerCase().includes(labelSearchQuery.toLowerCase())
    );
  }, [labels, labelSearchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            Add Data
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          {/* Data Source Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              Add Articles From:
            </h3>
            <div className="space-y-1.5">
              <label className="text-sm text-primary">
                Choose data source <span className="text-destructive">*</span>
              </label>
              <Select
                value={dataSource}
                onValueChange={(value) => setDataSource(value as Stage)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dataSources.map((ds) => (
                    <SelectItem key={ds} value={ds}>
                      {DataSourceSinkLabel[ds]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Article Type Selection */}
          <div className="grid sm:grid-cols-3 gap-2">
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleTypeToggle('included')}
              className={cn(
                'flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors cursor-pointer',
                selectedTypes.includes('included')
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:bg-muted/50'
              )}
            >
              <Checkbox
                checked={selectedTypes.includes('included')}
                onCheckedChange={() => handleTypeToggle('included')}
              />
              <span className="text-sm font-medium">Included Articles</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {articleCounts.included}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => handleTypeToggle('maybe')}
              className={cn(
                'flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors cursor-pointer',
                selectedTypes.includes('maybe')
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:bg-muted/50'
              )}
            >
              <Checkbox
                checked={selectedTypes.includes('maybe')}
                onCheckedChange={() => handleTypeToggle('maybe')}
              />
              <span className="text-sm font-medium">Maybe Articles</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {articleCounts.maybe}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => handleTypeToggle('labeled')}
              className={cn(
                'flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors cursor-pointer',
                selectedTypes.includes('labeled')
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:bg-muted/50'
              )}
            >
              <Checkbox
                checked={selectedTypes.includes('labeled')}
                onCheckedChange={() => handleTypeToggle('labeled')}
              />
              <span className="text-sm font-medium">Labeled Data</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground">
            Select labeled data to add it into {DataSourceSinkLabel[dataSink]}.
          </p>

          {/* Filter by Labels Section */}
          {isLabeledSelected && (
            <div className="space-y-2">
              <span className="text-sm text-primary">Filter By Labels</span>

              {/* Selected labels */}
              {selectedLabelIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedLabelIds.map((id) => {
                    const label = labels.find((l) => l.id === id);
                    if (!label) return null;
                    return (
                      <Badge
                        key={id}
                        variant="outline"
                        className="gap-1 pr-1 text-xs"
                        style={{
                          borderColor: label.color,
                          color: label.color,
                          backgroundColor: `${label.color}10`,
                        }}
                      >
                        {label.name}
                        <button
                          type="button"
                          onClick={() => handleLabelToggle(id)}
                          className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Label search + list */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={labelSearchQuery}
                    onChange={(e) => setLabelSearchQuery(e.target.value)}
                    placeholder="Search labels..."
                    className="pl-9 border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {filteredLabels.map((label) => (
                    <div
                      key={label.id}
                      onClick={() => handleLabelToggle(label.id)}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedLabelIds.includes(label.id)}
                        onCheckedChange={() => handleLabelToggle(label.id)}
                      />
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="text-sm text-foreground">
                        {label.name}
                        <span className="text-xs"> ({label.count})</span>
                      </span>
                    </div>
                  ))}
                  {filteredLabels.length === 0 && (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                      No labels found
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleAdd}
            disabled={selectedTypes.length === 0 || addData.isPending}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
