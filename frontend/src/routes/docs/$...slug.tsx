import { createFileRoute } from '@tanstack/react-router';
import { DocsLayout } from '@/components/blocks/docs-layout';

const modules = import.meta.glob('/src/docs/**/*.mdx');

export const Route = createFileRoute('/docs/$...slug')({
  loader: async ({ params }) => {
    const slugPath = params['*'];

    if (!slugPath) {
      throw new Error('Missing slug');
    }

    const match = Object.entries(modules).find(([path]) =>
      path.endsWith(`${slugPath}.mdx`)
    );

    if (!match) {
      throw new Error(`Doc "${slugPath}" not found`);
    }

    const mod = await match[1]();
    return { Component: mod.default };
  },
  component: DocsPage,
});

function DocsPage() {
  const { Component } = Route.useLoaderData();
  return (
    <DocsLayout siteTitle="My Docs">
      <Component />
    </DocsLayout>
  );
}
