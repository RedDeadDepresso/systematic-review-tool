import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import CommentForm from '@/components/blocks/pdf-dialog/comment-form';
import ContextMenu, {
  type ContextMenuProps,
} from '@/components/blocks/pdf-dialog/context-menu';
import ExpandableTip from '@/components/blocks/pdf-dialog/expandable.tip';
import HighlightContainer from '@/components/blocks/pdf-dialog/highlight-container';
import HighLightSidebar from '@/components/blocks/pdf-dialog/highlight-sidebar';
import { Header } from '@/components/blocks/pdf-dialog/header';
import { FloatingActions } from '@/components/blocks/pdf-dialog/floating-actions';
import {
  type GhostHighlight,
  LeftPanel,
  PdfHighlighter,
  type PdfHighlighterUtils,
  PdfLoader,
  type Tip,
  type ViewportHighlight,
  exportPdf,
} from 'react-pdf-highlighter-plus';
import {
  type CommentedHighlight,
  type Code,
} from '@/features/coding/types/codes';
import '@/styles/pdf-dialog.css';
import { CodingThemingSidebar } from '@/features/coding/components/coding-theming-sidebar';
import {
  useCreateCode,
  useDeleteCode,
  useFetchCodes,
  useUpdateCode,
} from '@/features/coding/hooks/use-codes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExtractionFormSidebar } from '@/features/extraction/components/data-extraction/extraction-sidebar';
import type { ReviewRole } from '@/features/reviews/types/reviews';
import { can } from '@/lib/permissions';

const parseIdFromHash = () => {
  return document.location.hash.slice('#highlight-'.length);
};

const resetHash = () => {
  document.location.hash = '';
};

function codesToHighlights(
  codes: Code[],
  referenceId: number
): CommentedHighlight[] {
  return codes.filter(
    (code) => code.reference === referenceId && code.position
  );
}

type PDFDialogProps = {
  title: string;
  reviewId: number;
  referenceId: number;
  fileUrl: string;
  userRole: ReviewRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  hasPrev: boolean;
  hasNext: boolean;
  readOnly?: boolean;
  pendingHighlightId?: string | null;
  onPendingHighlightConsumed?: () => void;
  onExtractionSuccess?: () => void;
  footer?: React.ReactNode;
};

export const PDFDialog = ({
  title,
  reviewId,
  referenceId: initialReferenceId,
  fileUrl,
  open,
  onOpenChange,
  onNavigate,
  hasPrev,
  hasNext,
  readOnly = true,
  userRole,
  pendingHighlightId,
  onPendingHighlightConsumed,
  onExtractionSuccess,
  footer,
}: PDFDialogProps) => {
  readOnly = readOnly || !can('modifyThemesCodes', userRole);
  const [referenceId, setReferenceId] = useState<number>(initialReferenceId);
  const [url, setUrl] = useState<string | Uint8Array>(fileUrl);
  const [highlights, setHighlights] = useState<Array<CommentedHighlight>>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
  const [pdfScaleValue, setPdfScaleValue] = useState<number | undefined>(
    undefined
  );
  const [highlightPen, setHighlightPen] = useState<boolean>(false);
  const [areaMode, setAreaMode] = useState<boolean>(false);
  const pendingHighlightIdRef = useRef<string | null>(null);

  // HighLightSidebar state
  const [highlightSidebarOpen, setHighlightSidebarOpen] =
    useState<boolean>(false);
  const [scrolledToHighlightId, setScrolledToHighlightId] = useState<
    string | null
  >(null);
  const [codingSidebarOpen, setCodingSidebarOpen] = useState<boolean>(false);
  const [extractionSidebarOpen, setExtractionSidebarOpen] =
    useState<boolean>(false);
  // Left panel state
  const [leftPanelOpen, setLeftPanelOpen] = useState<boolean>(false);
  // Dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('pdf-dialog-dark-mode') === 'true';
  });
  // Refs for PdfHighlighter utilities
  const highlighterUtilsRef = useRef<PdfHighlighterUtils | null>(null);
  const [, forceUpdate] = useState({});
  const hasInitializedUtilsRef = useRef(false);

  const { data: codes, isLoading: isCodesLoading } = useFetchCodes(reviewId);
  const createCode = useCreateCode();
  const updateCode = useUpdateCode();
  const deleteCode = useDeleteCode();

  const handleToggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('pdf-dialog-dark-mode', String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    setUrl(fileUrl);
  }, [fileUrl]);

  useEffect(() => {
    setReferenceId(initialReferenceId);
  }, [initialReferenceId]);

  useEffect(() => {
    if (codes && !isCodesLoading)
      setHighlights(codesToHighlights(codes, referenceId));
  }, [codes]);

  // Reset utils initialization flag when URL changes so forceUpdate triggers again
  useEffect(() => {
    highlighterUtilsRef.current = null;
    hasInitializedUtilsRef.current = false;
    if (codes && !isCodesLoading)
      setHighlights(codesToHighlights(codes, referenceId));
  }, [url]);

  // Click listeners for context menu
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [contextMenu]);

  // Track scrolled highlight from hash
  useEffect(() => {
    const handleHashChange = () => {
      const id = parseIdFromHash();
      setScrolledToHighlightId(id || null);
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Check initial hash

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleContextMenu = (
    event: MouseEvent<HTMLDivElement>,
    highlight: ViewportHighlight<CommentedHighlight>
  ) => {
    event.preventDefault();

    setContextMenu({
      xPos: event.clientX,
      yPos: event.clientY,
      deleteHighlight: () =>
        deleteHighlight(highlight as unknown as CommentedHighlight),
      editComment: () => editComment(highlight),
    });
  };

  const handleJumpToCode = (code: Code) => {
    if (code.reference === referenceId) {
      document.location.hash = `highlight-${code.id}`;
    } else if (code.reference && code.referenceFileUrl) {
      pendingHighlightIdRef.current = code.id.toString();
      setReferenceId(code.reference);
      setUrl(code.referenceFileUrl);
    }
  };

  const addHighlight = (
    highlight: GhostHighlight,
    name: string,
    comment: string
  ) => {
    console.log('Saving highlight', highlight);
    createCode.mutate(
      {
        review: reviewId,
        name: name,
        reference: referenceId,
        position: highlight.position,
        content: highlight.content,
        comment: comment,
        type: highlight.content?.text ? 'text' : 'area',
        highlightColor: '#FFE28F',
        highlightStyle: 'highlight',
      },
      {
        onSuccess: (data) => {
          setHighlights([data, ...highlights]);
        },
      }
    );
  };

  const deleteHighlight = (highlight: CommentedHighlight) => {
    console.log('Deleting highlight', highlight);
    deleteCode.mutate({
      id: highlight.id,
      reviewId: highlight.review,
    });
    setHighlights(highlights.filter((h) => h.id != highlight.id));
  };

  const editHighlight = (
    idToUpdate: string,
    edit: Partial<CommentedHighlight>
  ) => {
    console.log(`Editing highlight ${idToUpdate} with `, edit);
    updateCode.mutate({ id: idToUpdate, payload: edit });
    setHighlights(
      highlights.map((highlight) =>
        highlight.id === idToUpdate ? { ...highlight, ...edit } : highlight
      )
    );
  };

  const handleExportPdf = async () => {
    console.log('Exporting PDF with annotations...');
    try {
      const pdfBytes = await exportPdf(url, highlights, {
        onProgress: (current, total) => {
          console.log(`Exporting page ${current}/${total}`);
        },
      });

      // Download the file
      const blob = new Blob([pdfBytes as BlobPart], {
        type: 'application/pdf',
      });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'annotated-document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      console.log('PDF exported successfully!');
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to export PDF. See console for details.');
    }
  };

  const handleZoomIn = () => {
    const currentScale = pdfScaleValue || 1;
    setPdfScaleValue(Math.min(currentScale + 0.25, 3));
  };

  const handleZoomOut = () => {
    const currentScale = pdfScaleValue || 1;
    setPdfScaleValue(Math.max(currentScale - 0.25, 0.5));
  };

  const getHighlightById = useCallback(
    (id: string) => {
      return highlights.find((highlight) => highlight.id === id);
    },
    [highlights]
  );

  // Open comment tip and update highlight with new user input
  const editComment = (highlight: ViewportHighlight<CommentedHighlight>) => {
    if (readOnly) return;
    if (!highlighterUtilsRef.current) return;

    const editCommentTip: Tip = {
      position: highlight.position,
      content: (
        <CommentForm
          placeHolderName={highlight.name}
          placeHolderComment={highlight.comment}
          onSubmit={(name, comment) => {
            editHighlight(highlight.id, { name: name, comment: comment });
            highlighterUtilsRef.current!.setTip(null);
            highlighterUtilsRef.current!.toggleEditInProgress(false);
          }}
          content={highlight.content}
        ></CommentForm>
      ),
    };

    highlighterUtilsRef.current.setTip(editCommentTip);
    highlighterUtilsRef.current.toggleEditInProgress(true);
  };

  // Handle editing from sidebar - scroll to highlight first, then prompt user
  const handleEditFromSidebar = (highlight: CommentedHighlight) => {
    // Update the hash to scroll to the highlight
    document.location.hash = `highlight-${highlight.id}`;
    // The actual edit tip will need to be triggered after scrolling
    // For now, we just scroll - user can right-click to edit
  };

  // Scroll to highlight based on hash in the URL
  const scrollToHighlightFromHash = useCallback(() => {
    const highlight = getHighlightById(parseIdFromHash());

    if (highlight && highlighterUtilsRef.current) {
      highlighterUtilsRef.current.scrollToHighlight(highlight);
    }
  }, [getHighlightById]);

  // Hash listeners for autoscrolling to highlights
  useEffect(() => {
    window.addEventListener('hashchange', scrollToHighlightFromHash);

    return () => {
      window.removeEventListener('hashchange', scrollToHighlightFromHash);
    };
  }, [scrollToHighlightFromHash]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-screen h-dvh overflow-hidden flex pt-0 pr-0 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex h-full flex-col bg-background w-full">
          {/* Header */}
          <Header
            pdfScaleValue={pdfScaleValue}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onExportPdf={handleExportPdf}
            highlightSidebarOpen={highlightSidebarOpen}
            codingSidebarOpen={codingSidebarOpen}
            extractionSidebarOpen={extractionSidebarOpen}
            onToggleHighlightSidebar={() =>
              setHighlightSidebarOpen(!highlightSidebarOpen)
            }
            onToggleCodingSidebar={() => {
              setExtractionSidebarOpen(false);
              setCodingSidebarOpen(!codingSidebarOpen);
            }}
            onToggleExtractionSidebar={() => {
              setExtractionSidebarOpen(!extractionSidebarOpen);
              setCodingSidebarOpen(false);
            }}
            darkMode={darkMode}
            onToggleDarkMode={handleToggleDarkMode}
            onClose={() => onOpenChange(false)}
            onNavigate={onNavigate}
            hasNext={hasNext}
            hasPrev={hasPrev}
            readOnly={readOnly}
            title={title}
          />

          {/* Main content */}
          <div className="flex flex-1 overflow-hidden">
            {/* HighLightSidebar */}
            {!readOnly && (
              <HighLightSidebar
                highlights={highlights}
                scrolledToHighlightId={scrolledToHighlightId}
                onEditHighlight={handleEditFromSidebar}
                onDeleteHighlight={deleteHighlight}
                isOpen={highlightSidebarOpen}
              />
            )}

            {/* PDF Viewer with Left Panel */}
            <div className="relative flex-1 overflow-hidden flex h-full">
              <PdfLoader document={url}>
                {(pdfDocument) => (
                  <div className="flex h-full w-full">
                    {/* Left Panel - Outline & Thumbnails */}
                    <LeftPanel
                      pdfDocument={pdfDocument}
                      viewer={highlighterUtilsRef.current?.getViewer()}
                      linkService={highlighterUtilsRef.current?.getLinkService()}
                      eventBus={highlighterUtilsRef.current?.getEventBus()}
                      goToPage={highlighterUtilsRef.current?.goToPage}
                      isOpen={leftPanelOpen}
                      onOpenChange={setLeftPanelOpen}
                      width={280}
                      defaultTab="thumbnails"
                    />

                    {/* PDF Highlighter */}
                    <div className="flex-1 relative overflow-hidden">
                      <PdfHighlighter
                        enableAreaSelection={(event) =>
                          event.altKey || areaMode
                        }
                        areaSelectionMode={areaMode}
                        pdfDocument={pdfDocument}
                        theme={{ mode: darkMode ? 'dark' : 'light' }}
                        onScrollAway={resetHash}
                        utilsRef={(_pdfHighlighterUtils) => {
                          highlighterUtilsRef.current = _pdfHighlighterUtils;
                          if (!hasInitializedUtilsRef.current) {
                            hasInitializedUtilsRef.current = true;
                            forceUpdate({});

                            if (pendingHighlightId) {
                              const id = pendingHighlightId;
                              onPendingHighlightConsumed?.();

                              const tryScroll = () => {
                                const highlight = highlights.find(
                                  (h) => h.id === id
                                );
                                if (highlight && highlighterUtilsRef.current) {
                                  highlighterUtilsRef.current.scrollToHighlight(
                                    highlight
                                  );
                                  return;
                                }
                                requestAnimationFrame(tryScroll);
                              };
                              requestAnimationFrame(tryScroll);
                            }
                          }
                        }}
                        pdfScaleValue={pdfScaleValue}
                        textSelectionColor={
                          highlightPen && !readOnly
                            ? 'rgba(255, 226, 143, 1)'
                            : undefined
                        }
                        onSelection={
                          highlightPen && !readOnly
                            ? (selection) => {
                                addHighlight(
                                  selection.makeGhostHighlight(),
                                  '',
                                  ''
                                );
                              }
                            : undefined
                        }
                        selectionTip={
                          highlightPen || readOnly ? undefined : (
                            <ExpandableTip
                              addHighlight={(highlight, name, comment) => {
                                addHighlight(highlight, name, comment);
                                if (areaMode) setAreaMode(false);
                              }}
                            />
                          )
                        }
                        highlights={highlights}
                        style={{
                          height: '100%',
                        }}
                      >
                        <HighlightContainer
                          editHighlight={editHighlight}
                          deleteHighlight={(id) =>
                            deleteHighlight({ id } as CommentedHighlight)
                          }
                          onContextMenu={handleContextMenu}
                        />
                      </PdfHighlighter>
                    </div>
                  </div>
                )}
              </PdfLoader>

              {/* Floating Actions */}
              {!readOnly && (
                <FloatingActions
                  highlightPen={highlightPen}
                  onToggleHighlightPen={() => setHighlightPen(!highlightPen)}
                  areaMode={areaMode}
                  onToggleAreaMode={() => setAreaMode(!areaMode)}
                />
              )}
            </div>
            {/* Coding Theming Sidebar */}
            {!readOnly && (
              <>
                <ExtractionFormSidebar
                  referenceId={referenceId}
                  reviewId={reviewId}
                  isOpen={extractionSidebarOpen}
                  onExtractionSuccess={onExtractionSuccess}
                />
                <CodingThemingSidebar
                  reviewId={reviewId}
                  referenceId={referenceId}
                  isOpen={codingSidebarOpen}
                  handleJumpToCode={handleJumpToCode}
                />
              </>
            )}
          </div>
          {footer && <div className="shrink-0">{footer}</div>}

          {contextMenu && <ContextMenu {...contextMenu} />}
        </div>
      </DialogContent>
    </Dialog>
  );
};
