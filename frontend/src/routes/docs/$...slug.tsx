// Catch-all docs route: fetches and renders an MDX document by slug.
import { createFileRoute } from '@tanstack/react-router';
import { DocsTableOfContents } from '@/components/blocks/docs/docs-toc';
import { mdxComponents } from '@/components/blocks/docs/mdx-components';
import { useContext, useEffect, useRef } from 'react';
import { useTocFromContent } from '@/hooks/use-toc';
import { AppLayoutContext } from '@/context/app-layout-context';

const modules =
  import.meta.env.MODE === 'development'
    ? import.meta.glob('/src/docs/**/*.mdx')
    : import.meta.glob('/src/docs/user-guide/*.mdx');

export const Route = createFileRoute('/docs/$/slug')({
  loader: async ({ params }) => {
    const slugPath = (params as any)['*'];

    if (!slugPath) {
      throw new Error('Missing slug');
    }

    const match = Object.entries(modules).find(([path]) =>
      path.endsWith(`${slugPath}.mdx`)
    );

    if (!match) {
      throw new Error(`Doc '${slugPath}' not found`);
    }

    const mod = (await match[1]()) as { default: React.ComponentType<any> };
    return { Component: mod.default };
  },
  component: DocsPage,
});

function DocsPage() {
  const { Component } = Route.useLoaderData();
  const contentRef = useRef<HTMLDivElement>(null);
  const toc = useTocFromContent(contentRef, [Component]);
  const { setPageTitle } = useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('Documentation');
  }, []);

  return (
    <div className="flex scroll-mt-24 items-stretch pb-8 text-[15px] xl:w-full overflow-y-auto">
      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[40rem] min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-0 lg:py-8">
          {/* MDX body */}
          <div ref={contentRef} className="w-full flex-1 pb-16 sm:pb-0">
            <Component components={mdxComponents} />
          </div>
        </div>
      </div>

      {/* Sticky TOC */}
      <div className="sticky top-16 z-30 ml-auto hidden h-[90svh] w-52 flex-col gap-4 overflow-hidden pb-8 xl:flex">
        {toc.length > 0 && (
          <div className="no-scrollbar flex flex-col gap-8 overflow-y-auto">
            <DocsTableOfContents toc={toc} />
          </div>
        )}
      </div>
    </div>
  );
}
