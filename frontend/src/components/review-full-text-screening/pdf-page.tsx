import { Page } from 'react-pdf';
import { useEffect, useState } from 'react';
import type { Code } from '@/types/code';

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

export function PDFPage({
  pageNumber,
  codes,
}: {
  pageNumber: number;
  codes: Code[];
}) {
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [highlights, setHighlights] = useState<
    { x: number; y: number; width: number; height: number; color: string }[]
  >([]);

  /** Build highlight rectangles after text is loaded */
  useEffect(() => {
    if (!textItems.length || !codes.length) return;

    const rects: any[] = [];

    let cursor = 0; // character index walking through text items

    for (const item of textItems) {
      const itemStart = cursor;
      const itemEnd = cursor + item.str.length;
      cursor = itemEnd;

      // For each code highlight on this page
      codes.forEach((code) => {
        // No overlap with this text item
        if (
          code.character_end <= itemStart ||
          code.character_start >= itemEnd
        ) {
          return;
        }

        // Calculate highlight range inside this text item
        const localStart = Math.max(code.character_start - itemStart, 0);
        const localEnd = Math.min(
          code.character_end - itemStart,
          item.str.length
        );

        const charWidth = item.width / item.str.length;

        const highlightX = item.transform[4] + charWidth * localStart;
        const highlightWidth = charWidth * (localEnd - localStart);

        const highlightHeight = item.height;
        const highlightY = item.transform[5] - item.height; // PDF coordinates

        rects.push({
          x: highlightX,
          y: highlightY,
          width: highlightWidth,
          height: highlightHeight,
          color: code.color,
        });
      });
    }

    setHighlights(rects);
  }, [textItems, codes]);

  return (
    <div className="relative">
      <Page
        pageNumber={pageNumber}
        onGetTextSuccess={(textContent) =>
          setTextItems((textContent as any).items as TextItem[])
        }
      />

      {/* Highlight overlay layer */}
      <div className="absolute inset-0 pointer-events-none">
        {highlights.map((h, i) => (
          <div
            key={i}
            className="absolute opacity-40 rounded"
            style={{
              left: `${h.x}px`,
              top: `${h.y}px`,
              width: `${h.width}px`,
              height: `${h.height}px`,
              backgroundColor: h.color,
            }}
          />
        ))}
      </div>
    </div>
  );
}
