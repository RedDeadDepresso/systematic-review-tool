import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAutoResolveDuplicates } from '@/features/references/hooks/use-reference-clusters';
import { useFetchSearchMethods } from '@/features/reviews/hooks/use-search-methods';
import {
  IconSparkles,
  IconAlertCircle,
  IconInfoCircle,
  IconLink,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface AutoResolverFormProps {
  reviewId: number;
  detectFirst: boolean;
  onClose: () => void;
}

export function AutoResolverForm({
  reviewId,
  detectFirst,
  onClose,
}: AutoResolverFormProps) {
  const [confidenceThreshold, setConfidenceThreshold] = useState(90);
  const [fuzzyThreshold, setFuzzyThreshold] = useState(50);
  const [doiClustersAlways, setDoiClustersAlways] = useState(true);
  const [preferredSearchMethodId, setPreferredSearchMethodId] =
    useState<string>('none');

  const { data: searchMethods = [] } = useFetchSearchMethods(reviewId);
  const autoResolveMutation = useAutoResolveDuplicates(reviewId);

  const handleAutoResolve = () => {
    autoResolveMutation.mutate(
      {
        confidenceThreshold: confidenceThreshold / 100,
        detectFirst,
        fuzzyThreshold: fuzzyThreshold / 100,
        doiClustersAlways,
        preferredSearchMethodId:
          preferredSearchMethodId === 'none'
            ? null
            : parseInt(preferredSearchMethodId),
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
        {/* Context banner */}
        <Alert>
          <IconInfoCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {detectFirst ? (
              <>
                <strong>Find & Auto-Resolve:</strong> Detection will run first,
                then high-confidence clusters are resolved automatically.
                Anything below the threshold stays for manual review.
              </>
            ) : (
              <>
                <strong>Auto-Resolve existing clusters:</strong> No new
                detection will run. Clusters already found will be resolved
                based on the settings below.
              </>
            )}
          </AlertDescription>
        </Alert>

        {/* DOI hard-match */}
        <div className="flex items-center justify-between p-3.5 rounded-lg border">
          <div className="space-y-0.5 flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <IconLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Label className="font-medium leading-none">
                Always resolve DOI matches
              </Label>
              <Badge variant="secondary" className="text-xs">
                Recommended
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              References sharing the same DOI are guaranteed duplicates.
            </p>
          </div>
          <Switch
            checked={doiClustersAlways}
            onCheckedChange={setDoiClustersAlways}
          />
        </div>

        {/* Preferred source */}
        <div className="space-y-1.5">
          <Label htmlFor="preferred-source" className="text-sm font-medium">
            Preferred source to keep
          </Label>
          <Select
            value={preferredSearchMethodId}
            onValueChange={setPreferredSearchMethodId}
          >
            <SelectTrigger id="preferred-source" className="h-9">
              <SelectValue placeholder="Choose source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                Any source (use completeness score)
              </SelectItem>
              {searchMethods.map((method) => (
                <SelectItem key={method.id} value={method.id.toString()}>
                  {method.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Prefer references from this source when duplicates are found.
          </p>
        </div>

        {/* Detection sensitivity — only relevant when detecting */}
        {detectFirst && (
          <div className="space-y-3 p-3.5 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Detection sensitivity
              </Label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={fuzzyThreshold}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (v >= 30 && v <= 100) setFuzzyThreshold(v);
                  }}
                  className="w-14 px-2 py-1 text-sm border rounded text-center bg-background"
                  min="30"
                  max="100"
                />
                <span className="text-sm font-medium">%</span>
              </div>
            </div>
            <Slider
              value={[fuzzyThreshold]}
              onValueChange={(v) => setFuzzyThreshold(v[0])}
              min={30}
              max={100}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Minimum weighted similarity to form a cluster. Lower = wider net,
              more false positives.
            </p>
          </div>
        )}

        {/* Confidence threshold */}
        <div className="space-y-3 p-3.5 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Auto-resolution confidence
            </Label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={confidenceThreshold}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (v >= 50 && v <= 100) setConfidenceThreshold(v);
                }}
                className="w-14 px-2 py-1 text-sm border rounded text-center bg-background"
                min="50"
                max="100"
              />
              <span className="text-sm font-medium">%</span>
            </div>
          </div>
          <Slider
            value={[confidenceThreshold]}
            onValueChange={(v) => setConfidenceThreshold(v[0])}
            min={50}
            max={100}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            Clusters above this threshold are auto-resolved. Below it they stay
            for manual review.
          </p>
        </div>

        {confidenceThreshold < 87 && (
          <Alert variant="destructive">
            <IconAlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Warning:</strong> Below 87% may auto-resolve
              non-duplicates. Review carefully.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-5 py-3.5 border-t">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={autoResolveMutation.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAutoResolve}
            disabled={autoResolveMutation.isPending}
            className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <IconSparkles className="h-4 w-4" />
            {autoResolveMutation.isPending
              ? detectFirst
                ? 'Detecting…'
                : 'Resolving…'
              : detectFirst
                ? 'Find & Resolve'
                : 'Resolve'}
          </Button>
        </div>
      </div>
    </div>
  );
}
