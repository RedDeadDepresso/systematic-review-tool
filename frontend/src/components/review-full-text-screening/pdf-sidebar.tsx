import type { IHighlight } from 'react-pdf-highlighter';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  highlights: Array<IHighlight>;
}

const updateHash = (highlight: IHighlight) => {
  document.location.hash = `highlight-${highlight.id}`;
};

export function Sidebar({ highlights }: Props) {
  return (
    <aside className="w-[25vw] min-w-[280px] border-r bg-background">
      <Card className="rounded-none border-0 border-b">
        <CardHeader>
          <CardTitle className="text-base">Codes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Select text to highlight.
            <br />
            Hold <kbd className="px-1 rounded border text-xs">Alt</kbd> for area
            selection.
          </p>
        </CardContent>
      </Card>

      <ScrollArea className="h-[calc(100vh-120px)]">
        <ul className="flex flex-col gap-2 p-3">
          {highlights.map((highlight) => (
            <li key={highlight.id}>
              <button
                onClick={() => updateHash(highlight)}
                className="
                  w-full text-left rounded-xl border
                  p-3 transition
                  hover:bg-muted/50
                  focus:outline-none focus:ring-2 focus:ring-ring
                "
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="secondary">
                    Page {highlight.position.pageNumber}
                  </Badge>

                  {highlight.comment?.emoji && (
                    <span className="text-lg">{highlight.comment.emoji}</span>
                  )}
                </div>

                {highlight.comment?.text && (
                  <p className="text-sm font-medium line-clamp-2">
                    {highlight.comment.text}
                  </p>
                )}

                {highlight.content?.text && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                    {highlight.content.text.trim()}
                  </p>
                )}

                {highlight.content?.image && (
                  <img
                    src={highlight.content.image}
                    alt="Highlight screenshot"
                    className="mt-2 rounded-md border"
                  />
                )}
              </button>
            </li>
          ))}

          {highlights.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">
              No Codes yet
            </p>
          )}
        </ul>
      </ScrollArea>
    </aside>
  );
}
