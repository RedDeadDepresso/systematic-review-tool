// Container that sizes the references list based on the active layout.
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ArticleViewLayout } from '@/features/references/types/references';

interface ReferencesTableProps {
  children: ReactNode;
  viewLayout?: ArticleViewLayout;
}

export function ReferencesTable({
  children,
  viewLayout = 'title-only',
}: ReferencesTableProps) {
  return (
    <div
      className={cn(
        'flex flex-col min-h-0 overflow-hidden min-w-0',
        viewLayout === 'title-abstract' ? 'w-80' : 'flex-1'
      )}
    >
      {children}
    </div>
  );
}
