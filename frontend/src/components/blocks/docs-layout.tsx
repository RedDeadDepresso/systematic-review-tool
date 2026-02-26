import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  ChevronRight,
  Menu,
  BookOpen,
  ExternalLink,
  ArrowUp,
} from 'lucide-react';

// Types
interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface DocsLayoutProps {
  children: React.ReactNode;
}

// Table of Contents
function useToc(contentRef: React.RefObject<HTMLDivElement>) {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [active, setActive] = useState<string>('');

  useEffect(() => {
    if (!contentRef.current) return;
    const headings = Array.from(
      contentRef.current.querySelectorAll('h2, h3')
    ) as HTMLHeadingElement[];

    // Auto-assign IDs if missing
    headings.forEach((h) => {
      if (!h.id) {
        h.id = h
          .textContent!.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '');
      }
    });

    setToc(
      headings.map((h) => ({
        id: h.id,
        text: h.textContent ?? '',
        level: parseInt(h.tagName[1]),
      }))
    );
  }, [contentRef]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '0px 0px -70% 0px' }
    );

    toc.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [toc]);

  return { toc, active };
}

function TableOfContents({
  contentRef,
}: {
  contentRef: React.RefObject<HTMLDivElement>;
}) {
  const { toc, active } = useToc(contentRef);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (toc.length === 0) return null;

  return (
    <div className="sticky top-16 flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-2">
        On this page
      </p>
      <nav className="flex flex-col">
        {toc.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={cn(
              'block rounded px-2 py-1 text-sm transition-colors',
              item.level === 3 && 'pl-4',
              active === item.id
                ? 'text-primary font-medium bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {item.text}
          </a>
        ))}
      </nav>

      {showTop && (
        <>
          <Separator />
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <ArrowUp className="h-3.5 w-3.5" />
            Back to top
          </Button>
        </>
      )}
    </div>
  );
}

// Main Layout
export function DocsLayout({ children }: DocsLayoutProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-screen-xl flex">
        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="flex gap-8 xl:gap-12 px-6 md:px-10 py-10 max-w-4xl mx-auto">
            {/* MDX content */}
            <div
              ref={contentRef}
              className={cn(
                'flex-1 min-w-0',
                // Prose styles for MDX
                'prose prose-neutral dark:prose-invert max-w-none',
                'prose-headings:scroll-mt-20 prose-headings:font-semibold',
                'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
                'prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none',
                'prose-pre:bg-muted prose-pre:border prose-pre:rounded-lg',
                'prose-img:rounded-lg prose-img:border'
              )}
            >
              {children}
            </div>

            {/* TOC (desktop) */}
            <div className="hidden xl:block w-48 shrink-0">
              <TableOfContents contentRef={contentRef} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
