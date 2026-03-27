import { useEffect, useState } from 'react';

export interface TocItem {
  title: string;
  url: string;
  depth: number;
}

export function useTocFromContent(
  contentRef: React.RefObject<HTMLElement | null>,
  deps: any[] = []
) {
  const [toc, setToc] = useState<TocItem[]>([]);

  useEffect(() => {
    if (!contentRef.current) return;

    const headings = Array.from(
      contentRef.current.querySelectorAll('h2, h3, h4')
    ) as HTMLHeadingElement[];

    headings.forEach((h) => {
      if (!h.id) {
        h.id = h
          .textContent!.toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '');
      }
    });

    setToc(
      headings.map((h) => ({
        title: h.textContent ?? '',
        url: `#${h.id}`,
        depth: parseInt(h.tagName[1]),
      }))
    );
  }, [contentRef, ...deps]); // ← add deps so it reruns when MDX changes

  return toc;
}
