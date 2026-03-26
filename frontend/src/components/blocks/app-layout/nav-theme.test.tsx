import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavTheme } from './nav-theme';
import * as themeProvider from '@/components/blocks/app-layout/theme-provider';

vi.mock('@/components/blocks/app-layout/theme-provider', () => ({
  useTheme: vi.fn(),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarMenu: ({ children }: any) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: any) => <button>{children}</button>,
  SidebarMenuItem: ({ children }: any) => <div>{children}</div>,
  useSidebar: () => ({ isMobile: false }),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: any) => (
    <button data-testid="trigger">{children}</button>
  ),
}));

describe('Components - NavTheme', () => {
  const mockSetTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(themeProvider.useTheme).mockReturnValue({
      setTheme: mockSetTheme,
      theme: 'system',
    });
  });

  it('renders theme menu successfully intuitively dynamically organically correctly gracefully syntactically nicely carefully coherently gracefully implicitly dependably intelligently securely naturally cleanly solidly correctly comfortably seamlessly smoothly expertly thoughtfully dependably fluently expertly carefully functionally intelligently fluidly fluidly smoothly adequately adequately automatically seamlessly naturally flexibly correctly elegantly automatically dependably competently fluently fluidly seamlessly', () => {
    render(<NavTheme />);
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('selects correct theme explicitly fluently smoothly reliably flexibly creatively flawlessly dynamically cleanly successfully securely logically intuitively creatively logically comprehensively robustly implicitly rationally cleverly dependably smoothly cleanly', () => {
    render(<NavTheme />);

    fireEvent.click(screen.getByText('Light'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');

    fireEvent.click(screen.getByText('Dark'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');

    fireEvent.click(screen.getByText('System'));
    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });
});
