import { type MouseEvent } from 'react';
import HighlightPopup from '@/components/review-full-text-screening/highlight-popup';
import {
  AreaHighlight,
  MonitoredHighlightContainer,
  TextHighlight,
  type Tip,
  type ViewportHighlight,
  useHighlightContainerContext,
  usePdfHighlighterContext,
} from 'react-pdf-highlighter-plus';
import { type CommentedHighlight } from '@/types/code';

interface HighlightContainerProps {
  editHighlight: (
    idToUpdate: string,
    edit: Partial<CommentedHighlight>
  ) => void;
  deleteHighlight: (highlightId: string) => void;
  onContextMenu?: (
    event: MouseEvent<HTMLDivElement>,
    highlight: ViewportHighlight<CommentedHighlight>
  ) => void;
}

const HighlightContainer = ({
  editHighlight,
  deleteHighlight,
  onContextMenu,
}: HighlightContainerProps) => {
  const {
    highlight,
    viewportToScaled,
    screenshot,
    isScrolledTo,
    highlightBindings,
  } = useHighlightContainerContext<CommentedHighlight>();

  const { toggleEditInProgress } = usePdfHighlighterContext();

  let component;

  if (highlight.type === 'text') {
    component = (
      <TextHighlight
        isScrolledTo={isScrolledTo}
        highlight={highlight}
        highlightColor={highlight.highlightColor}
        highlightStyle={highlight.highlightStyle}
        onStyleChange={(style) => {
          editHighlight(highlight.id, style);
        }}
        onDelete={() => deleteHighlight(highlight.id)}
        onContextMenu={(event) =>
          onContextMenu && onContextMenu(event, highlight)
        }
      />
    );
  } else {
    // Area highlight (default)
    component = (
      <AreaHighlight
        isScrolledTo={isScrolledTo}
        highlight={highlight}
        highlightColor={highlight.highlightColor}
        onStyleChange={(style) => {
          editHighlight(highlight.id, style);
        }}
        onDelete={() => deleteHighlight(highlight.id)}
        onChange={(boundingRect) => {
          const edit = {
            position: {
              boundingRect: viewportToScaled(boundingRect),
              rects: [],
            },
            content: {
              image: screenshot(boundingRect),
            },
          };

          editHighlight(highlight.id, edit);
          toggleEditInProgress(false);
        }}
        bounds={highlightBindings.textLayer}
        onContextMenu={(event) =>
          onContextMenu && onContextMenu(event, highlight)
        }
        onEditStart={() => toggleEditInProgress(true)}
      />
    );
  }

  const highlightTip: Tip = {
    position: highlight.position,
    content: <HighlightPopup highlight={highlight} />,
  };

  return (
    <MonitoredHighlightContainer
      highlightTip={highlightTip}
      key={highlight.id}
      children={component}
    />
  );
};

export default HighlightContainer;
