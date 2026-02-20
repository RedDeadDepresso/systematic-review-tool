import {
  downloadJsonFile,
  downloadLatexFile,
  getJsonExport,
  getLatexExport,
} from '@/features/reviews/api/reviews';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

// Copy LaTeX to clipboard
export const copyLatexToClipboard = async (
  reviewId: number
): Promise<boolean> => {
  try {
    const data = await getLatexExport(reviewId);
    await navigator.clipboard.writeText(data.latexCode);
    return true;
  } catch (error) {
    toast.error('Failed to copy LaTeX: ' + (error as Error).message);
    return false;
  }
};

// Copy JSON to clipboard
export const copyJsonToClipboard = async (
  reviewId: number,
  pretty = true
): Promise<boolean> => {
  try {
    const data = await getJsonExport(reviewId);
    const jsonString = JSON.stringify(data, null, pretty ? 2 : 0);
    await navigator.clipboard.writeText(jsonString);
    return true;
  } catch (error) {
    toast.error('Failed to copy JSON: ' + (error as Error).message);
    return false;
  }
};

export function ExportDropdown({ reviewId }: { reviewId: number }) {
  const handleCopyLatex = async () => {
    const success = await copyLatexToClipboard(reviewId);
    if (success) {
      toast.success(
        'LaTeX copied to clipboard! Remember to add \\usepackage{tabularx} to your LaTeX preamble.'
      );
    } else {
      toast.error('Failed to copy LaTeX');
    }
  };

  const handleDownloadLatex = () => {
    downloadLatexFile(reviewId);
  };

  const handleCopyJson = async () => {
    const success = await copyJsonToClipboard(reviewId, true);
    if (success) {
      toast.success('JSON copied to clipboard!');
    } else {
      toast.error('Failed to copy JSON');
    }
  };

  const handleDownloadJson = () => {
    downloadJsonFile(reviewId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-transparent hidden sm:flex"
        >
          <Upload className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem onSelect={handleCopyJson}>Copy JSON</DropdownMenuItem>
        <DropdownMenuItem onSelect={handleDownloadJson}>
          Download JSON
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleCopyLatex}>
          Copy LaTeX
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleDownloadLatex}>
          Download LaTeX
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
