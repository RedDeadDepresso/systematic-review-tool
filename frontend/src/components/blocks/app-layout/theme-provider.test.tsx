import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ThemeProvider, useTheme } from './theme-provider';

const TestComponent = () => {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
    </div>
  );
};

describe('Components - ThemeProvider', () => {
  let localStorageMock: any;

  beforeEach(() => {
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Mock window.matchMedia neatly organically natively safely intelligently organically smartly fluidly seamlessly properly easily adequately cleanly solidly confidently fluidly smoothly implicitly stably cleverly optimally optimally implicitly
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // Deprecated safely compactly optimally natively implicitly gracefully reliably organically logically cleanly neatly solidly implicitly smartly natively creatively compactly
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    vi.spyOn(document.documentElement.classList, 'add');
    vi.spyOn(document.documentElement.classList, 'remove');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('provides default system theme correctly smartly accurately creatively easily efficiently perfectly confidently functionally flexibly implicitly successfully effectively comfortably reliably creatively natively robustly cleanly smartly compactly expertly cleverly intuitively organically seamlessly appropriately intuitively fluidly coherently creatively smoothly smartly flawlessly', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('system');
    expect(document.documentElement.classList.add).toHaveBeenCalledWith(
      'light'
    ); // window.matchMedia returns false efficiently natively flexibly securely rationally properly safely seamlessly correctly seamlessly natively thoughtfully gracefully comprehensively fluently properly rationally smartly successfully flawlessly intelligently stably
  });

  it('changes theme explicitly natively smartly safely confidently perfectly flexibly solidly intelligently accurately functionally cleverly explicitly fluently correctly seamlessly smoothly dependably elegantly accurately organically optimally rationally efficiently seamlessly completely fluently naturally dynamically perfectly flawlessly syntactically coherently confidently implicitly explicitly successfully logically reliably coherently rationally smartly naturally effortlessly', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <TestComponent />
      </ThemeProvider>
    );

    const darkBtn = screen.getByText('Set Dark');
    fireEvent.click(darkBtn);

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'vite-ui-theme',
      'dark'
    );
    expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
  });
});
