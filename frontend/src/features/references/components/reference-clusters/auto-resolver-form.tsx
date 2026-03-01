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
  onClose: () => void;
}

export function AutoResolverForm({ reviewId, onClose }: AutoResolverFormProps) {
  const [confidenceThreshold, setConfidenceThreshold] = useState(90);
  const [fuzzyThreshold, setFuzzyThreshold] = useState(50);
  const [detectFirst, setDetectFirst] = useState(true);
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
      {
        onSuccess: () => onClose(),
      }
    );
  };

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
        <div className="flex items-center gap-2">
          <IconSparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Systematic Auto Resolver</h3>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 min-h-0">
        {/* Info alert */}
        <Alert>
          <IconInfoCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <span>
              References are grouped into <strong>clusters</strong>. DOI matches
              are resolved instantly; fuzzy matches use a weighted similarity
              score across title, abstract, authors, and journal.{' '}
              {/* <a href="#" className="text-primary hover:underline">
              Learn more
            </a> */}
            </span>
          </AlertDescription>
        </Alert>

        {/* DOI clusters */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="space-y-0.5 flex-1">
            <div className="flex items-center gap-2">
              <IconLink className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Always resolve DOI matches</Label>
              <Badge variant="secondary" className="text-xs">
                Recommended
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              References sharing the same DOI are guaranteed duplicates —
              resolve them regardless of the confidence threshold.
            </p>
          </div>
          <Switch
            checked={doiClustersAlways}
            onCheckedChange={setDoiClustersAlways}
          />
        </div>

        {/* Preferred source */}
        <div className="space-y-2">
          <Label htmlFor="preferred-source">Preferred source to keep</Label>
          <Select
            value={preferredSearchMethodId}
            onValueChange={setPreferredSearchMethodId}
          >
            <SelectTrigger id="preferred-source">
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
            When duplicates are found, prefer keeping the reference from this
            source. Falls back to completeness scoring when unavailable.
          </p>
        </div>

        {/* Detect first toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="space-y-0.5 flex-1">
            <div className="flex items-center gap-2">
              <IconSparkles className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Detect new clusters first</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Run cluster detection before resolving. Disable if detection has
              already been run and you only want to resolve existing clusters.
            </p>
          </div>
          <Switch checked={detectFirst} onCheckedChange={setDetectFirst} />
        </div>

        {/* Detection threshold (shown only when detectFirst) */}
        {detectFirst && (
          <div className="space-y-4 pl-1">
            <div className="flex items-center justify-between">
              <Label className="font-medium text-sm">
                Detection sensitivity
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={fuzzyThreshold}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (v >= 30 && v <= 100) setFuzzyThreshold(v);
                  }}
                  className="w-16 px-2 py-1 text-sm border rounded text-center"
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
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Minimum weighted similarity to include a pair in a cluster. Lower
              values cast a wider net but may surface more false positives.
            </p>
          </div>
        )}

        {/* Confidence threshold */}
        <div className="space-y-4">
          <Badge variant="secondary" className="gap-1">
            <IconSparkles className="h-3 w-3" />
            Auto-resolution confidence
          </Badge>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Minimum cluster similarity to auto-resolve
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={confidenceThreshold}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (v >= 50 && v <= 100) setConfidenceThreshold(v);
                  }}
                  className="w-16 px-2 py-1 text-sm border rounded text-center"
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
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Clusters with a max similarity score above this threshold will be
              automatically resolved. Clusters below this threshold remain for
              manual review.
            </p>
          </div>
        </div>

        {/* Low-threshold warning */}
        {confidenceThreshold < 87 && (
          <Alert variant="destructive">
            <IconAlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> A threshold below 87% may auto-resolve
              clusters that are not actual duplicates. Review results carefully.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 border-t">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={autoResolveMutation.isPending}
            className="flex-1"
          >
            Close
          </Button>
          <Button
            onClick={handleAutoResolve}
            disabled={autoResolveMutation.isPending}
            className="flex-1 gap-2"
          >
            <IconSparkles className="h-4 w-4" />
            {autoResolveMutation.isPending ? 'Resolving...' : 'Resolve'}
          </Button>
        </div>
      </div>
    </div>
  );
}
