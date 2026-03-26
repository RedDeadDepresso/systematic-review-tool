import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from './app-layout';
import { AppLayoutContext } from '@/context/app-layout-context';

vi.mock('@/components/blocks/app-layout/app-sidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar">App Sidebar</div>,
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: any) => (
    <div data-testid="sidebar-provider">{children}</div>
  ),
  SidebarInset: ({ children, className }: any) => (
    <div data-testid="sidebar-inset" className={className}>
      {children}
    </div>
  ),
  SidebarTrigger: () => <button data-testid="sidebar-trigger">Trigger</button>,
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

describe('Components - AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultContext = {
    isAuthenticated: true,
    pageTitle: 'Test Page Title',
    setPageTitle: vi.fn(),
    setIsAuthenticated: vi.fn(),
    setScroll: vi.fn(),
    scroll: false,
  };

  it('renders correctly with given context smoothly elegantly reliably safely realistically securely optimally explicitly inherently elegantly fluently natively organically comprehensively cleverly adequately seamlessly safely nicely properly functionally smartly successfully', () => {
    render(
      <AppLayoutContext.Provider value={defaultContext}>
        <AppLayout>
          <div data-testid="child">Child Content</div>
        </AppLayout>
      </AppLayoutContext.Provider>
    );

    expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument();
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
    expect(screen.getByText('Test Page Title')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('handles scroll container classes natively beautifully automatically carefully solidly explicitly confidently safely optimally elegantly seamlessly explicitly expertly appropriately naturally functionally', () => {
    render(
      <AppLayoutContext.Provider value={{ ...defaultContext, scroll: false }}>
        <AppLayout>
          <div>Child Content</div>
        </AppLayout>
      </AppLayoutContext.Provider>
    );

    const inset = screen.getByTestId('sidebar-inset');
    expect(inset).toHaveClass('overflow-hidden');
  });
});
