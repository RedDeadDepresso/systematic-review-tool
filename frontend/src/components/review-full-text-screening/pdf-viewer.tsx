import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PdfLoader,
  PdfHighlighter,
  Highlight,
  AreaHighlight,
  Popup,
  Tip,
} from 'react-pdf-highlighter';
import type {
  IHighlight,
  NewHighlight,
  ScaledPosition,
  Content,
} from 'react-pdf-highlighter';

import { Spinner } from '../ui/spinner';
import 'react-pdf-highlighter/dist/style.css';
import { Sidebar } from './pdf-sidebar';
import type { Code } from '@/types/code';
import { useCreateCode } from '@/hooks/use-code';

const getNextId = () => String(Math.random()).slice(2);

const parseIdFromHash = () =>
  document.location.hash.slice('#highlight-'.length);

const resetHash = () => {
  document.location.hash = '';
};

const HighlightPopup = ({
  comment,
}: {
  comment: { text: string; emoji: string };
}) =>
  comment.text ? (
    <div className="Highlight__popup">
      {comment.emoji} {comment.text}
    </div>
  ) : null;

export function PDFViewer({
  referenceId,
  fileUrl,
  codes,
}: {
  referenceId: number;
  fileUrl: string;
  codes: Code[];
}) {
  const [highlights, setHighlights] = useState<Array<IHighlight>>(codes);
  const scrollViewerTo = useRef((highlight: IHighlight) => {});
  const createCode = useCreateCode();

  const scrollToHighlightFromHash = useCallback(() => {
    const highlight = getHighlightById(parseIdFromHash());
    if (highlight) {
      scrollViewerTo.current(highlight);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', scrollToHighlightFromHash, false);
    return () => {
      window.removeEventListener(
        'hashchange',
        scrollToHighlightFromHash,
        false
      );
    };
  }, [scrollToHighlightFromHash]);

  const getHighlightById = (id: string) => {
    return highlights.find((highlight) => highlight.id === id);
  };

  const addHighlight = (highlight: NewHighlight) => {
    createCode.mutate(
      {
        reference: referenceId,
        data: {
          reference: referenceId,
          position: highlight.position,
          content: highlight.content,
          comment: highlight.comment,
          color: 'yellow',
        },
      },
      {
        onSuccess: () => {
          setHighlights((prevHighlights) => [
            { ...highlight, id: getNextId() },
            ...prevHighlights,
          ]);
        },
      }
    );
  };

  const updateHighlight = (
    highlightId: string,
    position: Partial<ScaledPosition>,
    content: Partial<Content>
  ) => {
    console.log('Updating highlight', highlightId, position, content);
    setHighlights((prevHighlights) =>
      prevHighlights.map((h) => {
        const {
          id,
          position: originalPosition,
          content: originalContent,
          ...rest
        } = h;
        return id === highlightId
          ? {
              id,
              position: { ...originalPosition, ...position },
              content: { ...originalContent, ...content },
              ...rest,
            }
          : h;
      })
    );
  };

  return (
    <div className="flex h-screen w-full relative">
      <Sidebar highlights={highlights} />
      <div className="h-screen w-full relative">
        <PdfLoader
          url={fileUrl}
          beforeLoad={
            <div className="w-full h-[80vh] flex items-center justify-center">
              <Spinner className="size-12" />
            </div>
          }
        >
          {(pdfDocument) => (
            <PdfHighlighter
              pdfDocument={pdfDocument}
              enableAreaSelection={(event) => event.altKey}
              onScrollChange={resetHash}
              scrollRef={(scrollTo) => {
                scrollViewerTo.current = scrollTo;
                scrollToHighlightFromHash();
              }}
              onSelectionFinished={(
                position,
                content,
                hideTipAndSelection,
                transformSelection
              ) => (
                <Tip
                  onOpen={transformSelection}
                  onConfirm={(comment) => {
                    addHighlight({ content, position, comment });
                    hideTipAndSelection();
                  }}
                />
              )}
              highlightTransform={(
                highlight,
                index,
                setTip,
                hideTip,
                viewportToScaled,
                screenshot,
                isScrolledTo
              ) => {
                const isTextHighlight = !highlight.content?.image;

                const component = isTextHighlight ? (
                  <Highlight
                    isScrolledTo={isScrolledTo}
                    position={highlight.position}
                    comment={highlight.comment}
                  />
                ) : (
                  <AreaHighlight
                    isScrolledTo={isScrolledTo}
                    highlight={highlight}
                    onChange={(boundingRect) => {
                      updateHighlight(
                        highlight.id,
                        { boundingRect: viewportToScaled(boundingRect) },
                        { image: screenshot(boundingRect) }
                      );
                    }}
                  />
                );

                return (
                  <Popup
                    popupContent={<HighlightPopup {...highlight} />}
                    onMouseOver={(popupContent) =>
                      setTip(highlight, (highlight) => popupContent)
                    }
                    onMouseOut={hideTip}
                    key={index}
                  >
                    {component}
                  </Popup>
                );
              }}
              highlights={highlights}
            />
          )}
        </PdfLoader>
      </div>
    </div>
  );
}
