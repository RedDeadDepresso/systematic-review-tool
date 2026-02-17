import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useAutoResolvePreview,
  useAutoResolveDuplicates,
} from '@/hooks/use-reference-duplicate';
import { useSearchMethods } from '@/hooks/use-search-method';
import {
  IconSparkles,
  IconAlertCircle,
  IconInfoCircle,
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

interface DeduplicationCriteria {
  authors: boolean;
  title: boolean;
  journal: boolean;
  year: boolean;
  pages: boolean;
  doi: boolean;
}

export function AutoResolverForm({ reviewId, onClose }: AutoResolverFormProps) {
  const [similarityThreshold, setSimilarityThreshold] = useState(90);
  const [createPairsFirst] = useState(false);
  const [textNormalization, setTextNormalization] = useState(false);
  const [importedFile, setImportedFile] = useState<string>('none'); // Changed to string with default "none"

  const [criteria, setCriteria] = useState<DeduplicationCriteria>({
    authors: false,
    title: false,
    journal: false,
    year: false,
    pages: false,
    doi: false,
  });

  const { data: searchMethods = [] } = useSearchMethods(reviewId);
  const { data: preview, isLoading: loadingPreview } = useAutoResolvePreview(
    reviewId,
    similarityThreshold / 100,
    !createPairsFirst
  );

  const autoResolveMutation = useAutoResolveDuplicates(reviewId);

  const handleAutoResolve = () => {
    autoResolveMutation.mutate(
      {
        confidenceThreshold: similarityThreshold / 100,
        createPairsFirst,
        criteria: criteria,
        textNormalization,
        preferredSearchMethodId:
          importedFile === 'none' ? null : parseInt(importedFile),
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const handleCriteriaChange = (field: keyof DeduplicationCriteria) => {
    setCriteria((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* Fixed Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
        <div className="flex items-center gap-2">
          <IconSparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Systematic Auto Resolver</h3>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 min-h-0">
        {/* Info Alert */}
        <Alert>
          <IconInfoCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            The system will keep the best article based on your chosen criteria
            and remove the duplicates.{' '}
            <a href="#" className="text-primary hover:underline">
              Learn more
            </a>
          </AlertDescription>
        </Alert>

        {/* Imported References */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <IconInfoCircle className="h-3 w-3" />
              Choose the duplicate best version to keep
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="imported-file">Imported References</Label>
            <Select value={importedFile} onValueChange={setImportedFile}>
              <SelectTrigger id="imported-file">
                <SelectValue placeholder="Choose File" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any source</SelectItem>
                {searchMethods.map((method) => (
                  <SelectItem key={method.id} value={method.id.toString()}>
                    {method.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              If duplicates are found, keep the reference from this source
            </p>
          </div>
        </div>

        {/* Deduplication Criteria */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <IconSparkles className="h-3 w-3" />
              Select your deduplication criteria
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Authors */}
            <div
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => handleCriteriaChange('authors')}
            >
              <div className="flex items-center gap-3 pointer-events-none">
                <Checkbox
                  id="authors"
                  checked={criteria.authors}
                  onCheckedChange={() => {}}
                />
                <Label htmlFor="authors" className="font-medium cursor-pointer">
                  Authors
                </Label>
              </div>
              <span className="text-xs text-muted-foreground">Exact Match</span>
            </div>

            {/* Journal */}
            <div
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => handleCriteriaChange('journal')}
            >
              <div className="flex items-center gap-3 pointer-events-none">
                <Checkbox
                  id="journal"
                  checked={criteria.journal}
                  onCheckedChange={() => {}}
                />
                <Label htmlFor="journal" className="font-medium cursor-pointer">
                  Journal
                </Label>
              </div>
              <span className="text-xs text-muted-foreground">Exact Match</span>
            </div>

            {/* Title */}
            <div
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => handleCriteriaChange('title')}
            >
              <div className="flex items-center gap-3 pointer-events-none">
                <Checkbox
                  id="title"
                  checked={criteria.title}
                  onCheckedChange={() => {}}
                />
                <Label htmlFor="title" className="font-medium cursor-pointer">
                  Title
                </Label>
              </div>
              <span className="text-xs text-muted-foreground">Exact Match</span>
            </div>

            {/* Year */}
            <div
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => handleCriteriaChange('year')}
            >
              <div className="flex items-center gap-3 pointer-events-none">
                <Checkbox
                  id="year"
                  checked={criteria.year}
                  onCheckedChange={() => {}}
                />
                <Label htmlFor="year" className="font-medium cursor-pointer">
                  Year
                </Label>
              </div>
              <span className="text-xs text-muted-foreground">Exact Match</span>
            </div>

            {/* Pages */}
            <div
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => handleCriteriaChange('pages')}
            >
              <div className="flex items-center gap-3 pointer-events-none">
                <Checkbox
                  id="pages"
                  checked={criteria.pages}
                  onCheckedChange={() => {}}
                />
                <Label htmlFor="pages" className="font-medium cursor-pointer">
                  Pages
                </Label>
              </div>
              <span className="text-xs text-muted-foreground">Exact Match</span>
            </div>

            {/* DOI */}
            <div
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => handleCriteriaChange('doi')}
            >
              <div className="flex items-center gap-3 pointer-events-none">
                <Checkbox
                  id="doi"
                  checked={criteria.doi}
                  onCheckedChange={() => {}}
                />
                <Label htmlFor="doi" className="font-medium cursor-pointer">
                  DOI
                </Label>
              </div>
              <span className="text-xs text-muted-foreground">Exact Match</span>
            </div>
          </div>
        </div>

        {/* Similarity Threshold Slider */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox id="similarity" checked={true} disabled />
            <Label className="font-medium">
              Articles Similarity Percentage
            </Label>
          </div>

          <div className="space-y-2 ml-8">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Minimum Overall Similarity
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={similarityThreshold}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 50 && val <= 100) {
                      setSimilarityThreshold(val);
                    }
                  }}
                  className="w-16 px-2 py-1 text-sm border rounded text-center"
                  min="50"
                  max="100"
                />
                <span className="text-sm font-medium">%</span>
              </div>
            </div>

            <Slider
              value={[similarityThreshold]}
              onValueChange={(values) => setSimilarityThreshold(values[0])}
              min={50}
              max={100}
              step={1}
              className="w-full"
            />

            <p className="text-xs text-muted-foreground mt-2">
              The Minimum Overall Similarity % measures the similarity of the
              entire reference. The percentage selected only applies to the
              overall similarity and not to any other selection criteria. All
              selected criteria must match for a duplicate to be resolved.
            </p>
          </div>
        </div>

        {/* Auto Resolver Settings */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <IconSparkles className="h-3 w-3" />
              Set up auto resolver settings
            </Badge>
          </div>

          {/* Text Normalization */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center gap-2">
                <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Text Normalization</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Normalize text by removing special characters, extra spaces, and
                converting to lowercase
              </p>
            </div>
            <Switch
              checked={textNormalization}
              onCheckedChange={setTextNormalization}
            />
          </div>
        </div>

        {/* Preview */}
        {!createPairsFirst &&
          (loadingPreview ? (
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
          ) : null)}

        {/* Update warning threshold */}
        {similarityThreshold < 87 && (
          <Alert variant="destructive">
            <IconAlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> A threshold below 87% may auto-resolve
              pairs that are not actual duplicates. Review results carefully.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Fixed Footer */}
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
