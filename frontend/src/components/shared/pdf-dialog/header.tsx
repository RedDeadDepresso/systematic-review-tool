import {
  Download,
  Minus,
  Moon,
  Plus,
  Sun,
  Network,
  FileText,
  Highlighter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components//ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HeaderProps {
  pdfScaleValue: number | undefined;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onExportPdf: () => void;
  highlightSidebarOpen: boolean;
  codingSidebarOpen: boolean;
  extractionSidebarOpen: boolean;
  onToggleHighlightSidebar: () => void;
  onToggleCodingSidebar: () => void;
  onToggleExtractionSidebar: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  readOnly?: boolean;
}

export function Header({
  pdfScaleValue,
  onZoomIn,
  onZoomOut,
  onExportPdf,
  highlightSidebarOpen,
  codingSidebarOpen,
  extractionSidebarOpen,
  onToggleHighlightSidebar,
  onToggleCodingSidebar,
  onToggleExtractionSidebar,
  darkMode,
  onToggleDarkMode,
  readOnly = true,
}: HeaderProps) {
  const displayZoom = pdfScaleValue
    ? `${Math.round(pdfScaleValue * 100)}%`
    : 'Auto';

  return (
    <TooltipProvider>
      <header className="flex h-14 items-center justify-between border-b bg-background px-4">
        {/* Left section - Logo and sidebar toggle */}
        <div className="flex items-center gap-3">
          {!readOnly && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={highlightSidebarOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={onToggleHighlightSidebar}
                  className="h-9 w-9"
                >
                  <Highlighter className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {highlightSidebarOpen
                  ? 'Hide highlight sidebar'
                  : 'Show highlight sidebar'}
              </TooltipContent>
            </Tooltip>
          )}

          <Separator orientation="vertical" className="h-6" />
        </div>

        {/* Right section - Zoom controls and export */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 rounded-md border bg-muted/50 p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onZoomOut}
                  className="h-7 w-7"
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>

            <span className="min-w-[60px] text-center text-sm font-medium">
              {displayZoom}
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onZoomIn}
                  className="h-7 w-7"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom in</TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Dark mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleDarkMode}
                className="h-9 w-9"
              >
                {darkMode ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {darkMode ? 'Light mode' : 'Dark mode'}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6" />

          {/* Export button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onExportPdf}>
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export PDF with annotations</TooltipContent>
          </Tooltip>
        </div>

        {/* Left section - Logo and sidebar toggle */}
        <div className="flex items-center gap-3">
          {!readOnly && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={extractionSidebarOpen ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={onToggleExtractionSidebar}
                    className="h-9 w-9"
                  >
                    <FileText className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {extractionSidebarOpen
                    ? 'Hide extraction sidebar'
                    : 'Show extraction sidebar'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={codingSidebarOpen ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={onToggleCodingSidebar}
                    className="h-9 w-9"
                  >
                    <Network className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {codingSidebarOpen
                    ? 'Hide coding sidebar'
                    : 'Show coding sidebar'}
                </TooltipContent>
              </Tooltip>
            </>
          )}

          <Separator orientation="vertical" className="h-6" />
        </div>
      </header>
    </TooltipProvider>
  );
}
