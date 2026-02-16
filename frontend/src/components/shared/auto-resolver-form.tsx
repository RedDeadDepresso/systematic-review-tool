import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useAutoResolvePreview,
  useAutoResolveDuplicates,
} from '@/hooks/use-reference-duplicate';
import { IconSparkles, IconAlertCircle } from '@tabler/icons-react';

interface AutoResolverFormProps {
  reviewId: number;
  onClose: () => void;
}

export function AutoResolverForm({ reviewId, onClose }: AutoResolverFormProps) {
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.9);
  const [createPairsFirst, setCreatePairsFirst] = useState(true);

  const { data: preview, isLoading: loadingPreview } = useAutoResolvePreview(
    reviewId,
    confidenceThreshold,
    true
  );

  const autoResolveMutation = useAutoResolveDuplicates(reviewId);

  const handleAutoResolve = () => {
    autoResolveMutation.mutate(
      {
        confidenceThreshold,
        createPairsFirst,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const thresholdPercentage = Math.round(confidenceThreshold * 100);

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <IconSparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Auto-Resolver Settings</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Automatically resolve duplicate pairs with high similarity scores
        </p>
      </div>

      {/* Confidence Threshold Slider */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Confidence Threshold</Label>
            <span className="text-sm font-medium">{thresholdPercentage}%</span>
          </div>
          <Slider
            value={[confidenceThreshold * 100]}
            onValueChange={(values) => setConfidenceThreshold(values[0] / 100)}
            min={50}
            max={100}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Only pairs with similarity ≥ {thresholdPercentage}% will be
            auto-resolved
          </p>
        </div>

        {/* Threshold guidance */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-2 rounded-lg bg-muted">
            <p className="font-medium">Conservative</p>
            <p className="text-muted-foreground">95-100%</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-primary/10">
            <p className="font-medium">Balanced</p>
            <p className="text-muted-foreground">85-94%</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-destructive/10">
            <p className="font-medium">Aggressive</p>
            <p className="text-muted-foreground">50-84%</p>
          </div>
        </div>
      </div>

      {/* Create Pairs First Option */}
      <div className="flex items-center justify-between p-4 rounded-lg border">
        <div className="space-y-0.5">
          <Label className="font-medium">Detect duplicates first</Label>
          <p className="text-sm text-muted-foreground">
            Run duplicate detection before auto-resolving
          </p>
        </div>
        <Switch
          checked={createPairsFirst}
          onCheckedChange={setCreatePairsFirst}
        />
      </div>

      {/* Preview */}
      {loadingPreview ? (
        <Alert>
          <AlertDescription>Loading preview...</AlertDescription>
        </Alert>
      ) : preview ? (
        <Alert>
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Preview:</p>
              <ul className="space-y-1 text-sm">
                <li>
                  • Total unresolved pairs:{' '}
                  <strong>{preview.totalUnresolved}</strong>
                </li>
                <li>
                  • Will auto-resolve:{' '}
                  <strong className="text-primary">
                    {preview.wouldAutoResolve}
                  </strong>
                </li>
                <li>
                  • Remaining to review manually:{' '}
                  <strong>{preview.remainingAfter}</strong>
                </li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>
            {createPairsFirst
              ? 'Enable preview by disabling "Detect duplicates first"'
              : 'No duplicate pairs found. Enable "Detect duplicates first" to find them.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Warning for aggressive threshold */}
      {thresholdPercentage < 85 && (
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> A threshold below 85% may auto-resolve
            pairs that are not actual duplicates. Review results carefully.
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={handleAutoResolve}
          disabled={autoResolveMutation.isPending}
          className="flex-1"
        >
          {autoResolveMutation.isPending
            ? 'Starting...'
            : 'Start Auto-Resolution'}
        </Button>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={autoResolveMutation.isPending}
        >
          Cancel
        </Button>
      </div>

      {/* Info */}
      <Alert>
        <AlertDescription className="text-xs">
          <strong>How it works:</strong> The system will keep the reference with
          more complete data (longer abstract, DOI present, PDF attached, etc.)
          and mark the other as duplicate.
        </AlertDescription>
      </Alert>
    </div>
  );
}
