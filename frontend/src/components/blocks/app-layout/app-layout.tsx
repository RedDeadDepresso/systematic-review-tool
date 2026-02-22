import { AppSidebar } from '@/components/blocks/app-layout/app-sidebar';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { useContext } from 'react';
import { AppLayoutContext } from '@/context/app-layout-context';
import { cn } from '@/lib/utils';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pageTitle, scroll } = useContext(AppLayoutContext);
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-screen flex flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            {pageTitle}
          </div>
        </header>
        <div
          className={cn(
            '@container/main flex-1 px-4 lg:px-6',
            scroll ? 'overflow-y-auto' : 'overflow-hidden'
          )}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
