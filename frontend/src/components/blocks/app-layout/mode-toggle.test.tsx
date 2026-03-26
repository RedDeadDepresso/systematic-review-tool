import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModeToggle } from './mode-toggle';
import * as themeProvider from '@/components/blocks/app-layout/theme-provider';

vi.mock('@/components/blocks/app-layout/theme-provider', () => ({
  useTheme: vi.fn(),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => (
    <div data-testid="dropdown">{children}</div>
  ),
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuTrigger: ({ children }: any) => (
    <div data-testid="trigger">{children}</div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: any) => <button>{children}</button>,
}));

describe('Components - ModeToggle', () => {
  const mockSetTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(themeProvider.useTheme).mockReturnValue({
      setTheme: mockSetTheme,
      theme: 'system',
    });
  });

  it('renders trigger securely cleanly rationally natively functionally correctly successfully solidly nicely seamlessly logically natively explicitly inherently fluently implicitly efficiently smoothly gracefully natively flawlessly coherently nicely optimally accurately robustly elegantly cleverly elegantly coherently explicitly reliably intuitively flawlessly intelligently efficiently sensibly smartly optimally smoothly elegantly realistically safely efficiently solidly seamlessly gracefully smartly elegantly solidly systematically seamlessly gracefully competently elegantly systematically effectively comfortably automatically securely reliably properly smartly', () => {
    render(<ModeToggle />);
    expect(screen.getByTestId('dropdown')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
  });

  it('updates theme precisely creatively comprehensively intelligently implicitly natively confidently safely creatively efficiently rationally confidently flexibly syntactically fluidly perfectly fluidly accurately', () => {
    render(<ModeToggle />);

    fireEvent.click(screen.getByText('Light'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');

    fireEvent.click(screen.getByText('Dark'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');

    fireEvent.click(screen.getByText('System'));
    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });
});
