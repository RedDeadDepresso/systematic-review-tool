import {
  Download,
  Minus,
  Moon,
  Plus,
  Sun,
  Network,
  FileText,
  Highlighter,
  X,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components//ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

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
  title: string;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  hasPrev: boolean;
  hasNext: boolean;
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
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
  readOnly = true,
  title,
}: HeaderProps) {
  const displayZoom = pdfScaleValue
    ? `${Math.round(pdfScaleValue * 100)}%`
    : 'Auto';

  return (
    <TooltipProvider>
      <header className="flex h-14 items-center justify-between border-b bg-background px-4">
        {/* Left section */}
        <div className="flex items-center gap-2 w-[160px]">
          {!readOnly && (
            <>
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
            </>
          )}
        </div>

        {/* Centre section - Navigation + Title */}
        <div className="flex items-center gap-2 flex-1 justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onNavigate('prev')}
            disabled={!hasPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-sm font-medium text-foreground line-clamp-1 max-w-xl">
            {title}
          </h1>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onNavigate('next')}
            disabled={!hasNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Right section - Dropdown + Close */}
        <div className="flex items-center gap-2 w-[160px] justify-end">
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
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More options</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              {/* Zoom controls */}
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm">Zoom</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onZoomOut}
                    className="h-7 w-7"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[44px] text-center text-xs font-medium">
                    {displayZoom}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onZoomIn}
                    className="h-7 w-7"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={onToggleDarkMode}>
                {darkMode ? (
                  <>
                    <Sun className="mr-2 h-4 w-4" />
                    Light mode
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-4 w-4" />
                    Dark mode
                  </>
                )}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={onExportPdf}>
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close</TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
}
