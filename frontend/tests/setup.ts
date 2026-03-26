import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Polyfill ResizeObserver (used by Radix UI Slider, Popover, etc.)
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill IntersectionObserver (used by some Radix UI primitives)
globalThis.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords() {
    return [];
  }
} as any;

// Polyfill window.matchMedia (used by useMediaQuery / responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000/api');

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

const locationMock = {
  href: '',
  assign: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
};

Object.defineProperty(window, 'location', {
  writable: true,
  value: locationMock,
});
