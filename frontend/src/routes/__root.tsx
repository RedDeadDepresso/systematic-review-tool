import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { AppLayout } from '@/components/blocks/app-layout/app-layout';

export const Route = createRootRoute({
  component: () => (
    <>
      <Toaster position="top-center" closeButton />
      <AppLayout>
        <Outlet />
      </AppLayout>
    </>
  ),
});
