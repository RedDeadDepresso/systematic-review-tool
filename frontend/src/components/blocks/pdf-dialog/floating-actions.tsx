// Floating action bar that appears on text selection in the PDF viewer.
import { useState } from 'react';
import { Plus, X, Highlighter, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FloatingActionsProps {
  highlightPen: boolean;
  onToggleHighlightPen: () => void;
  areaMode: boolean;
  onToggleAreaMode: () => void;
}

export function FloatingActions({
  highlightPen,
  onToggleHighlightPen,
  areaMode,
  onToggleAreaMode,
}: FloatingActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isAnyModeActive = highlightPen || areaMode;

  return (
    <TooltipProvider>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3">
        {/* Action buttons - shown when FAB is open */}
        {isOpen && (
          <div className="flex flex-col-reverse gap-2">
            {/* Highlight Pen */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={highlightPen ? 'default' : 'outline'}
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-md"
                  onClick={() => {
                    onToggleHighlightPen();
                    if (!highlightPen) setIsOpen(false);
                  }}
                >
                  <Highlighter className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {highlightPen ? 'Exit highlight mode' : 'Highlight pen'}
              </TooltipContent>
            </Tooltip>

            {/* Area Highlight */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={areaMode ? 'default' : 'outline'}
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-md"
                  onClick={() => {
                    console.log('Area mode toggled:', !areaMode);
                    onToggleAreaMode();
                    if (!areaMode) setIsOpen(false);
                  }}
                >
                  <Square className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {areaMode ? 'Exit area mode' : 'Area highlight'}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Main FAB button */}
        <Button
          size="icon"
          className={cn(
            'h-14 w-14 rounded-full shadow-lg transition-transform',
            isOpen && 'rotate-45',
            isAnyModeActive && 'bg-primary'
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>
    </TooltipProvider>
  );
}
