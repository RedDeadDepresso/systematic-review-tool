import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './use-mobile';

describe('useIsMobile', () => {
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = window.innerWidth;

  // Track mock instances
  let mockMatchMediaInst: any = null;

  beforeEach(() => {
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => {
        const inst = {
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        };
        mockMatchMediaInst = inst;
        return inst;
      }),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: originalInnerWidth,
    });
    vi.clearAllMocks();
    mockMatchMediaInst = null;
  });

  const setScreenWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: width,
    });

    if (
      mockMatchMediaInst &&
      mockMatchMediaInst.addEventListener.mock.calls.length > 0
    ) {
      // Find the change listener and invoke it
      const call = mockMatchMediaInst.addEventListener.mock.calls.find(
        (c: any) => c[0] === 'change'
      );
      if (call) call[1](new Event('change'));
    }
  };

  it('should return false when screen is larger than mobile breakpoint', () => {
    setScreenWidth(1024); // Desktop
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('should return true when screen is smaller than mobile breakpoint', () => {
    setScreenWidth(375); // Mobile
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('should update when screen size changes to mobile', () => {
    setScreenWidth(1024);
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    act(() => {
      setScreenWidth(500);
    });

    expect(result.current).toBe(true);
  });

  it('should update when screen size changes from mobile to desktop', () => {
    setScreenWidth(500);
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);

    act(() => {
      setScreenWidth(1024);
    });

    expect(result.current).toBe(false);
  });

  it('should cleanup event listeners on unmount', () => {
    const { unmount } = renderHook(() => useIsMobile());

    unmount();

    expect(mockMatchMediaInst.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
  });
});
